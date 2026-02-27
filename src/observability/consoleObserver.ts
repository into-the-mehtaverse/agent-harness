// src/observability/consoleObserver.ts

import type { RunObserver } from './types';
import type { AgentRunResult } from '../agent/state';

/**
 * Observer that prints the run summary and final answer/error to stdout.
 * Same output that was previously inline in index.ts.
 */
export class ConsoleRunObserver implements RunObserver {
  onRunFinished(result: AgentRunResult): void {
    // eslint-disable-next-line no-console
    console.log('=== Agent run summary ===');
    // eslint-disable-next-line no-console
    console.log('runId:', result.runId);
    // eslint-disable-next-line no-console
    console.log('status:', result.status);
    // eslint-disable-next-line no-console
    console.log('terminationReason:', result.terminationReason);
    // eslint-disable-next-line no-console
    console.log('totalToolCalls:', result.totalToolCalls);
    // eslint-disable-next-line no-console
    console.log('steps:', result.steps.length);

    if (result.finalAnswer) {
      // eslint-disable-next-line no-console
      console.log('\n=== Final answer ===\n');
      // eslint-disable-next-line no-console
      console.log(result.finalAnswer.content);
    } else if (result.error) {
      // eslint-disable-next-line no-console
      console.error('\n=== Error ===\n');
      // eslint-disable-next-line no-console
      console.error(result.error);
    }
  }
}
