// src/observability/types.ts

import type { AgentRunResult, AgentStep } from '../agent/state';
import type { StreamChunk } from '../llm/types';

export interface RunObserver {
  onRunFinished(result: AgentRunResult): void | Promise<void>;
  /**
   * Optional: called for each streamed chunk during a model call (content deltas, then done).
   * Use this to show "thinking" or reply text as it arrives.
   */
  onStreamChunk?(chunk: StreamChunk): void | Promise<void>;
  /**
   * Optional: called for each step pushed in the agent loop (model_call, tool_invocation, tool_result, termination).
   * Use this to drive SSE or other real-time visibility (e.g. "Calling tool X", "Tool X completed").
   */
  onStep?(step: AgentStep): void | Promise<void>;
}
