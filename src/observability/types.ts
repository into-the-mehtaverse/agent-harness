// src/observability/types.ts

import type { AgentRunResult } from '../agent/state';
import type { StreamChunk } from '../llm/types';

export interface RunObserver {
  onRunFinished(result: AgentRunResult): void | Promise<void>;
  /**
   * Optional: called for each streamed chunk during a model call (content deltas, then done).
   * Use this to show "thinking" or reply text as it arrives.
   */
  onStreamChunk?(chunk: StreamChunk): void | Promise<void>;
}
