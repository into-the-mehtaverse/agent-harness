// src/agent/state.ts

import type {
    LLMMessage,
    SystemMessage,
    UserMessage,
    AssistantMessage,
  } from '../llm/types';
  import type { ToolInvocation, ToolResult, ToolName } from '../tools/types';
  
  /**
   * High-level status of an agent run.
   */
  export type AgentRunStatus =
    | 'idle'
    | 'running'
    | 'completed'
    | 'failed'
    | 'terminated';
  
  /**
   * Why the agent loop stopped.
   */
  export type TerminationReason =
    | 'max_steps_reached'
    | 'tool_error'
    | 'model_error'
    | 'user_stopped'
    | 'completed';
  
  /**
   * Configuration for a single agent run.
   * This is immutable once the run starts.
   */
  export interface AgentConfig {
    /**
     * Maximum number of loop iterations / tool call cycles allowed.
     */
    maxSteps: number;
  
    /**
     * Optional hard cap on how many tool calls are allowed in total.
     */
    maxToolCalls?: number;
  
    /**
     * Optional per-step timeout for model calls in milliseconds.
     */
    modelCallTimeoutMs?: number;
  
    /**
     * Optional per-tool-call timeout in milliseconds (default may come from the tool).
     */
    toolCallTimeoutMs?: number;
  
    /**
     * Optional flag to allow the agent to answer without using tools.
     */
    allowNoToolAnswer?: boolean;
  
    /**
     * Arbitrary experiment / run metadata (e.g. model name, experiment id).
     */
    metadata?: Record<string, unknown>;
  }
  
  /**
   * Minimal description of the "task" or goal for the agent.
   * This can be enriched later, but keeps v1 simple.
   */
  export interface AgentTask {
    id: string;
    /**
     * Natural language description of what the agent is supposed to do.
     */
    description: string;
    /**
     * Optional structured input payload for advanced use cases.
     */
    input?: unknown;
  }
  
  /**
   * A single step in the agent loop.
   */
  export type AgentStepType =
    | 'model_call'
    | 'tool_invocation'
    | 'tool_result'
    | 'termination';
  
  export interface BaseAgentStep {
    id: string;
    index: number; // 0-based step index
    type: AgentStepType;
    startedAt: Date;
    finishedAt?: Date;
  }
  
  /**
   * Step representing a call to the LLM (model).
   */
  export interface ModelCallStep extends BaseAgentStep {
    type: 'model_call';
    /**
     * The messages sent to the model for this call.
     */
    inputMessages: LLMMessage[];
    /**
     * The assistant message returned by the model (could include tool calls).
     */
    outputMessage?: AssistantMessage;
    /**
     * Error if the model call failed.
     */
    error?: string;
  }
  
  /**
   * Step representing the decision to invoke one or more tools.
   */
  export interface ToolInvocationStep extends BaseAgentStep {
    type: 'tool_invocation';
    /**
     * The raw tool invocations derived from the assistant's tool calls.
     */
    invocations: ToolInvocation[];
  }
  
  /**
   * Step representing the completion of tool executions.
   */
  export interface ToolResultStep extends BaseAgentStep {
    type: 'tool_result';
    /**
     * Results corresponding to the invocations from the previous step.
     */
    results: ToolResult[];
  }
  
  /**
   * Final step representing that the agent loop decided to stop.
   */
  export interface TerminationStep extends BaseAgentStep {
    type: 'termination';
    reason: TerminationReason;
    /**
     * Optional human-readable explanation, e.g. which tool failed.
     */
    details?: string;
  }
  
  export type AgentStep =
    | ModelCallStep
    | ToolInvocationStep
    | ToolResultStep
    | TerminationStep;
  
  /**
   * Agent memory / state during a single run.
   * The loop function will read and update this.
   */
  export interface AgentState {
    runId: string;
    task: AgentTask;
    config: AgentConfig;
  
    status: AgentRunStatus;
    terminationReason?: TerminationReason | undefined;
    error?: string | undefined;
  
    /**
     * Full message history that will be fed to the model
     * (system, user, assistant, and tool messages).
     */
    messages: LLMMessage[];
  
    /**
     * Steps taken so far in the loop.
     */
    steps: AgentStep[];
  
    /**
     * How many tool calls have been made in total across all steps.
     */
    totalToolCalls: number;
  
    /**
     * Optional final answer message from the assistant, once the run completes.
     */
    finalAnswer?: AssistantMessage;
  
    /**
     * Optional set of tool names available for this run.
     * This is a convenience for logging and debugging.
     */
    availableTools?: ToolName[];
  
    createdAt: Date;
    updatedAt: Date;
  }
  
  /**
   * Summary of a finished run, suitable for logging / evaluation.
   */
  export interface AgentRunResult {
    state: AgentState;
    /**
     * Convenience fields pulled from state.
     */
    runId: string;
    status: AgentRunStatus;
    terminationReason?: TerminationReason | undefined;
    finalAnswer?: AssistantMessage | undefined;
    error?: string | undefined;
    steps: AgentStep[];
    totalToolCalls: number;
    createdAt: Date;
    updatedAt: Date;
  }
  
  /**
   * Helper type for constructing the initial state.
   */
  export interface AgentInitialStateParams {
    runId: string;
    task: AgentTask;
    config: AgentConfig;
    /**
     * System prompt and initial user message that seed the conversation.
     */
    systemMessage: SystemMessage;
    userMessage: UserMessage;
    /**
     * Optional list of tool names available for this run.
     */
    availableTools?: ToolName[];
  }