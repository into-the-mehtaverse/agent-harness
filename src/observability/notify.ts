// src/observability/notify.ts

import type { RunObserver } from './types';
import type { AgentRunResult } from '../agent/state';

/**
 * Notify all run observers that a run has finished.
 * Owns the iteration and await pattern; extend here for onStepFinished etc. later.
 */
export async function notifyRunFinished(
  observers: RunObserver[],
  result: AgentRunResult,
): Promise<void> {
  for (const observer of observers) {
    await Promise.resolve(observer.onRunFinished(result));
  }
}
