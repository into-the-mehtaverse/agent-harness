// src/observability/types.ts

import type { AgentRunResult } from '../agent/state';

export interface RunObserver {
  onRunFinished(result: AgentRunResult): void | Promise<void>;
}
