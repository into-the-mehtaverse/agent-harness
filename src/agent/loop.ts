// src/agent/loop.ts

import type { LLMClient, LLMModelId, AssistantMessage, StreamChunk } from '../llm/types';
import type { ToolDefinition } from '../tools/types';
import type { ToolExecutor } from '../tools/executor';
import { now as nowUtil } from '../utils/time';
import { toErrorMessage } from '../utils/error';
import { createToolLogger, toolCallsToInvocations } from './utils';
import {
  type AgentTask, type AgentConfig, type AgentState, type AgentRunResult, type AgentStep,
  type ModelCallStep, type ToolInvocationStep, type ToolResultStep, type TerminationStep, type TerminationReason,
  createInitialState, getNextStepMeta, stateToRunResult, appendToolResultMessages,
} from './state';
import { createDefaultContextPreparator, type ContextPreparator } from './context';
import type { RunObserver } from '../observability/types';
import { notifyRunFinished } from '../observability/notify';

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

function statusForTerminationReason(reason: TerminationReason): AgentState['status'] {
  if (reason === 'model_error') return 'failed';
  if (reason === 'completed') return 'completed';
  return 'terminated';
}

/**
 * Create a termination step, push it, update state, and set termination reason.
 * Call this when the loop should stop; the caller should then break.
 */
function terminateRun(
  state: AgentState,
  reason: TerminationReason,
  details: string,
  options: { error?: string } | undefined,
  pushStep: (step: AgentStep) => void,
  now: () => Date,
): void {
  const meta = getNextStepMeta(state);
  const step: TerminationStep = {
    id: meta.id,
    index: meta.index,
    type: 'termination',
    startedAt: now(),
    finishedAt: now(),
    reason,
    details,
  };
  pushStep(step);
  state.status = statusForTerminationReason(reason);
  state.terminationReason = reason;
  if (options?.error !== undefined) {
    state.error = options.error;
  }
}

function commitModelCallSuccess(
  state: AgentState,
  message: AssistantMessage,
  modelCallStep: ModelCallStep,
  pushStep: (step: AgentStep) => void,
  now: () => Date,
): { assistantMessage: AssistantMessage } {
  modelCallStep.outputMessage = message;
  state.messages.push(message);
  modelCallStep.finishedAt = now();
  pushStep(modelCallStep);
  return { assistantMessage: message };
}

/**
 * Execute one model call, record the step, and return the assistant message or error.
 * When llm.chatStream exists and onStreamChunk is provided, streams tokens and calls onStreamChunk for each delta.
 */
async function executeModelCall(
  state: AgentState,
  params: {
    model: LLMModelId;
    llm: LLMClient;
    toolDefinitions: ToolDefinition[];
    config: AgentConfig;
  },
  pushStep: (step: AgentStep) => void,
  now: () => Date,
  onStreamChunk?: (chunk: StreamChunk) => void,
): Promise<{ assistantMessage?: AssistantMessage; error?: string }> {
  const { model, llm, toolDefinitions, config } = params;
  const meta = getNextStepMeta(state);

  const modelCallStep: ModelCallStep = {
    id: meta.id,
    index: meta.index,
    type: 'model_call',
    startedAt: now(),
    inputMessages: [...state.messages],
  };

  const chatParams = {
    model,
    messages: state.messages,
    tools: toolDefinitions,
    toolChoice: 'auto' as const,
    ...(config.modelCallTimeoutMs !== undefined && {
      timeoutMs: config.modelCallTimeoutMs,
    }),
  } satisfies Parameters<LLMClient['chat']>[0];

  try {
    const useStream =
      llm.chatStream != null &&
      onStreamChunk != null;

    if (useStream) {
      let message: AssistantMessage | undefined;
      const stream = llm.chatStream!(chatParams);
      for await (const chunk of stream) {
        onStreamChunk(chunk);
        if (chunk.done === true && chunk.message != null) {
          message = chunk.message;
          break;
        }
      }
      if (message == null) {
        modelCallStep.error = 'Stream ended without a final message';
        modelCallStep.finishedAt = now();
        pushStep(modelCallStep);
        return { error: modelCallStep.error };
      }
      if (message.role !== 'assistant') {
        modelCallStep.error = `Expected assistant message, got role "${message.role}"`;
        modelCallStep.finishedAt = now();
        pushStep(modelCallStep);
        return { error: modelCallStep.error };
      }
      return commitModelCallSuccess(state, message, modelCallStep, pushStep, now);
    }

    const response = await llm.chat(chatParams);
    const { message } = response;

    if (message.role !== 'assistant') {
      modelCallStep.error = `Expected assistant message, got role "${message.role}"`;
      modelCallStep.finishedAt = now();
      pushStep(modelCallStep);
      return { error: modelCallStep.error };
    }
    return commitModelCallSuccess(state, message, modelCallStep, pushStep, now);
  } catch (err) {
    modelCallStep.error = toErrorMessage(err, 'Unknown model error');
    modelCallStep.finishedAt = now();
    pushStep(modelCallStep);
    return { error: modelCallStep.error };
  }
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

  const onStreamChunk = (chunk: StreamChunk) => {
    for (const o of runObservers) {
      o.onStreamChunk?.(chunk);
    }
  };

  try {
    for (let i = 0; i < config.maxSteps; i++) {
      const stepIndex = state.steps.length;

      // 1) Call the model with the current messages
      const modelResult = await executeModelCall(
        state,
        { model, llm, toolDefinitions, config },
        pushStep,
        now,
        onStreamChunk,
      );

      if (!modelResult.assistantMessage) {
        terminateRun(
          state,
          'model_error',
          'Model call failed or returned non-assistant message.',
          modelResult.error !== undefined ? { error: modelResult.error } : undefined,
          pushStep,
          now,
        );
        break;
      }

      const assistantMessage = modelResult.assistantMessage;
      const toolCalls = assistantMessage.toolCalls ?? [];

      if (!toolCalls.length) {
        state.finalAnswer = assistantMessage;
        terminateRun(
          state,
          'completed',
          'Assistant returned a final answer without tool calls.',
          undefined,
          pushStep,
          now,
        );
        break;
      }

      const maxToolCalls = config.maxToolCalls ?? Infinity;
      const projectedTotal = state.totalToolCalls + toolCalls.length;
      if (projectedTotal > maxToolCalls) {
        terminateRun(
          state,
          'max_steps_reached',
          `Max tool calls exceeded: ${projectedTotal} > ${maxToolCalls}`,
          undefined,
          pushStep,
          now,
        );
        break;
      }

      // 2) Convert tool calls into invocations and record step
      const invocations = toolCallsToInvocations(toolCalls, stepIndex);
      const invMeta = getNextStepMeta(state);
      const invocationStep: ToolInvocationStep = {
        id: invMeta.id,
        index: invMeta.index,
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

      const resMeta = getNextStepMeta(state);
      const resultStep: ToolResultStep = {
        id: resMeta.id,
        index: resMeta.index,
        type: 'tool_result',
        startedAt: now(),
        finishedAt: now(),
        results: toolResults,
      };
      pushStep(resultStep);

      // 4) Feed tool results back into the model as tool messages
      appendToolResultMessages(state, toolResults);

      if (i === config.maxSteps - 1) {
        terminateRun(
          state,
          'max_steps_reached',
          'Reached maxSteps without explicit completion.',
          undefined,
          pushStep,
          now,
        );
        break;
      }
    }
  } catch (err) {
    const message = toErrorMessage(err);
    terminateRun(
      state,
      'model_error',
      message,
      { error: message },
      pushStep,
      now,
    );
  }

  const result = stateToRunResult(state);
  await notifyRunFinished(runObservers, result);
  return result;
}
