// src/agent/loop.ts

import type { LLMClient, LLMModelId, AssistantMessage, LLMMessage } from '../llm/types';
import type { ToolDefinition } from '../tools/types';
import type { ToolExecutor } from '../tools/executor';
import { generateRunId } from '../utils/id';
import { now as nowUtil } from '../utils/time';
import { createToolLogger } from './utils';
import {
  type AgentTask,
  type AgentConfig,
  type AgentState,
  type AgentRunResult,
  type AgentStep,
  type ModelCallStep,
  type ToolInvocationStep,
  type ToolResultStep,
  type TerminationStep,
} from './state';
import { createDefaultContextPreparator } from './context';
import type { ContextPreparator } from './context';
import type { RunObserver } from '../observability/types';

export interface RunAgentLoopParams {
  task: AgentTask;
  config: AgentConfig;
  model: LLMModelId;
  llm: LLMClient;
  toolDefinitions: ToolDefinition[];
  toolExecutor: ToolExecutor;
  contextPreparator?: ContextPreparator;
  runObservers?: RunObserver[];
}

const defaultContextPreparator = createDefaultContextPreparator();

/**
 * Create a new AgentState for a run.
 */
function createInitialState(params: {
  task: AgentTask;
  config: AgentConfig;
  system: LLMMessage;
  user: LLMMessage;
  toolDefinitions: ToolDefinition[];
}): AgentState {
  const { task, config, system, user, toolDefinitions } = params;
  const now = nowUtil();
  const runId = generateRunId();

  return {
    runId,
    task,
    config,
    status: 'idle',
    messages: [system, user],
    steps: [],
    totalToolCalls: 0,
    availableTools: toolDefinitions.map((t) => t.name),
    createdAt: now,
    updatedAt: now,
  };
}

export async function runAgentLoop(
  params: RunAgentLoopParams,
): Promise<AgentRunResult> {
  const {
    task,
    config,
    model,
    llm,
    toolDefinitions,
    toolExecutor,
    contextPreparator = defaultContextPreparator,
    runObservers = [],
  } = params;

  const { system, user } = contextPreparator.prepare({
    task,
    config,
    tools: toolDefinitions,
  });

  let state = createInitialState({ task, config, system, user, toolDefinitions });
  state.status = 'running';
  state.updatedAt = nowUtil();

  const now = () => nowUtil();

  const pushStep = (step: AgentStep) => {
    state.steps.push(step);
    state.updatedAt = now();
  };

  try {
    for (let i = 0; i < config.maxSteps; i++) {
      const stepIndex = state.steps.length;

      // 1) Call the model with the current messages
      const modelCallStep: ModelCallStep = {
        id: `step-${stepIndex}`,
        index: stepIndex,
        type: 'model_call',
        startedAt: now(),
        inputMessages: [...state.messages],
      };

      let assistantMessage: AssistantMessage | undefined;

      try {
        const chatParams = {
          model,
          messages: state.messages,
          tools: toolDefinitions,
          toolChoice: 'auto' as const,
          ...(config.modelCallTimeoutMs !== undefined && {
            timeoutMs: config.modelCallTimeoutMs,
          }),
        } satisfies Parameters<LLMClient['chat']>[0];

        const response = await llm.chat(chatParams);

        const { message } = response;
        if (message.role !== 'assistant') {
          modelCallStep.error = `Expected assistant message, got role "${message.role}"`;
        } else {
          assistantMessage = message;
          modelCallStep.outputMessage = assistantMessage;
          state.messages.push(assistantMessage);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : `Unknown model error: ${String(err)}`;
        modelCallStep.error = msg;
      } finally {
        modelCallStep.finishedAt = now();
        pushStep(modelCallStep);
      }

      if (!assistantMessage) {
        // Model failed; terminate the run.
        const terminationStep: TerminationStep = {
          id: `step-${state.steps.length}`,
          index: state.steps.length,
          type: 'termination',
          startedAt: now(),
          finishedAt: now(),
          reason: 'model_error',
          details: 'Model call failed or returned non-assistant message.',
        };
        pushStep(terminationStep);

        state.status = 'failed';
        state.terminationReason = 'model_error';
        state.error = modelCallStep.error;
        break;
      }

      const toolCalls = assistantMessage.toolCalls ?? [];

      if (!toolCalls.length) {
        // No tool calls: treat this as a final answer.
        state.finalAnswer = assistantMessage;

        const terminationStep: TerminationStep = {
          id: `step-${state.steps.length}`,
          index: state.steps.length,
          type: 'termination',
          startedAt: now(),
          finishedAt: now(),
          reason: 'completed',
          details: 'Assistant returned a final answer without tool calls.',
        };
        pushStep(terminationStep);

        state.status = 'completed';
        state.terminationReason = 'completed';
        break;
      }

      // If we have tool calls, check the maxToolCalls constraint.
      const maxToolCalls = config.maxToolCalls ?? Infinity;
      const projectedTotal = state.totalToolCalls + toolCalls.length;
      if (projectedTotal > maxToolCalls) {
        const terminationStep: TerminationStep = {
          id: `step-${state.steps.length}`,
          index: state.steps.length,
          type: 'termination',
          startedAt: now(),
          finishedAt: now(),
          reason: 'max_steps_reached',
          details: `Max tool calls exceeded: ${projectedTotal} > ${maxToolCalls}`,
        };
        pushStep(terminationStep);

        state.status = 'terminated';
        state.terminationReason = 'max_steps_reached';
        break;
      }

      // 2) Convert tool calls into invocations
      const invocations = toolCalls.map((tc, idx: number) => {
        let parsedArgs: unknown;
        try {
          parsedArgs = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          // If parsing fails, we pass the raw string; the tool will likely error.
          parsedArgs = { _raw: tc.arguments };
        }

        return {
          callId: tc.id || `toolcall-${stepIndex}-${idx}`,
          toolName: tc.name,
          args: parsedArgs,
        };
      });

      const invocationStep: ToolInvocationStep = {
        id: `step-${state.steps.length}`,
        index: state.steps.length,
        type: 'tool_invocation',
        startedAt: now(),
        finishedAt: now(),
        invocations,
      };
      pushStep(invocationStep);

      // 3) Execute tools
      const toolResults = await toolExecutor.execute(invocations, {
        now,
        env: process.env as Record<string, string | undefined>,
        log: createToolLogger(),
      });

      state.totalToolCalls += toolResults.length;

      const resultStep: ToolResultStep = {
        id: `step-${state.steps.length}`,
        index: state.steps.length,
        type: 'tool_result',
        startedAt: now(),
        finishedAt: now(),
        results: toolResults,
      };
      pushStep(resultStep);

      // 4) Feed tool results back into the model as tool messages
      for (const result of toolResults) {
        const content = result.ok
          ? JSON.stringify(result.data ?? null)
          : JSON.stringify(
              {
                error: result.error,
              },
              null,
              2,
            );

        const toolMessage: LLMMessage = {
          role: 'tool',
          content,
          toolCallId: result.callId,
        };
        state.messages.push(toolMessage);
      }

      // If this was the last allowed step, terminate.
      if (i === config.maxSteps - 1) {
        const terminationStep: TerminationStep = {
          id: `step-${state.steps.length}`,
          index: state.steps.length,
          type: 'termination',
          startedAt: now(),
          finishedAt: now(),
          reason: 'max_steps_reached',
          details: 'Reached maxSteps without explicit completion.',
        };
        pushStep(terminationStep);

        state.status = 'terminated';
        state.terminationReason = 'max_steps_reached';
        break;
      }
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : `Unknown error: ${String(err)}`;
    state.status = 'failed';
    state.terminationReason = 'model_error';
    state.error = message;

    const terminationStep: TerminationStep = {
      id: `step-${state.steps.length}`,
      index: state.steps.length,
      type: 'termination',
      startedAt: now(),
      finishedAt: now(),
      reason: 'model_error',
      details: message,
    };
    pushStep(terminationStep);
  }

  // Build the result view.
  const result: AgentRunResult = {
    state,
    runId: state.runId,
    status: state.status,
    terminationReason: state.terminationReason,
    finalAnswer: state.finalAnswer,
    error: state.error,
    steps: state.steps,
    totalToolCalls: state.totalToolCalls,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };

  for (const observer of runObservers) {
    await Promise.resolve(observer.onRunFinished(result));
  }

  return result;
}
