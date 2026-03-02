// src/streaming/sse.ts
//
// SSE adapter: turns agent loop steps + stream chunks into Server-Sent Events.
// Transport-agnostic: only uses a send(event, data) callback.

import type {
  AgentStep,
  AgentRunResult,
  ToolInvocationStep,
  ToolResultStep,
  TerminationStep,
} from '../agent/state';
import type { StreamChunk } from '../llm/types';
import type { RunObserver } from '../observability/types';

/** SSE event names the client can subscribe to. */
export type SseEventType =
  | 'thinking'
  | 'text_delta'
  | 'tool_start'
  | 'tool_result'
  | 'step'
  | 'done'
  | 'error';

/** Serializable payload for "thinking" (model call in progress). */
export interface SseThinkingPayload {
  runId: string;
}

/** Serializable payload for "text_delta" (stream chunk). */
export interface SseTextDeltaPayload {
  contentDelta?: string;
  reasoningDelta?: string;
  done?: boolean;
}

/** Serializable payload for "tool_start" (tool invocation step). */
export interface SseToolStartPayload {
  stepId: string;
  stepIndex: number;
  toolNames: string[];
  startedAt: string; // ISO
}

/** Serializable payload for "tool_result" (tool result step). */
export interface SseToolResultPayload {
  stepId: string;
  stepIndex: number;
  toolNames: string[];
  ok: boolean[];
  finishedAt: string; // ISO
}

/** Serializable payload for "step" (generic step for extensibility). */
export interface SseStepPayload {
  stepId: string;
  stepIndex: number;
  type: string;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
}

/** Serializable payload for "done" (run finished). */
export interface SseDonePayload {
  runId: string;
  status: string;
  terminationReason?: string;
  finalAnswer?: { content?: unknown };
  error?: string;
}

/** Serializable payload for "error" (run or stream error). */
export interface SseErrorPayload {
  message: string;
}

export type SsePayload =
  | SseThinkingPayload
  | SseTextDeltaPayload
  | SseToolStartPayload
  | SseToolResultPayload
  | SseStepPayload
  | SseDonePayload
  | SseErrorPayload;

export type SseSend = (event: SseEventType, data: SsePayload) => void | Promise<void>;

/**
 * Format one SSE message (event name + data line + double newline).
 */
export function formatSSE(event: SseEventType, data: SsePayload): string {
  const dataLine = `data: ${JSON.stringify(data)}`;
  return `event: ${event}\n${dataLine}\n\n`;
}

function stepToSerializable(step: AgentStep): { startedAt: string; finishedAt?: string } {
  const startedAt = step.startedAt instanceof Date ? step.startedAt.toISOString() : String(step.startedAt);
  const finishedAt =
    step.finishedAt instanceof Date ? step.finishedAt.toISOString() : step.finishedAt != null ? String(step.finishedAt) : undefined;
  return finishedAt !== undefined ? { startedAt, finishedAt } : { startedAt };
}

/**
 * Create a RunObserver that forwards steps and stream chunks as SSE events via send().
 * Use this from the /run/stream route: pass a send that writes to the response stream.
 */
export function createSseRunObserver(runId: string, send: SseSend): RunObserver {
  let thinkingSent = false;

  return {
    onStreamChunk(chunk: StreamChunk): void {
      if (!thinkingSent) {
        thinkingSent = true;
        send('thinking', { runId });
      }
      const payload: SseTextDeltaPayload = { done: chunk.done === true };
      if (chunk.contentDelta !== undefined) payload.contentDelta = chunk.contentDelta;
      if (chunk.reasoningDelta !== undefined) payload.reasoningDelta = chunk.reasoningDelta;
      send('text_delta', payload);
    },

    onStep(step: AgentStep): void {
      const { startedAt, finishedAt } = stepToSerializable(step);

      const stepSummary =
        step.type === 'tool_invocation'
          ? `Calling ${(step as ToolInvocationStep).invocations.map((i) => i.toolName).join(', ')}`
          : step.type === 'tool_result'
            ? 'Tools completed'
            : step.type === 'termination'
              ? (step as TerminationStep).details
              : undefined;
      const stepPayload: SseStepPayload = { stepId: step.id, stepIndex: step.index, type: step.type, startedAt };
      if (finishedAt !== undefined) stepPayload.finishedAt = finishedAt;
      if (stepSummary !== undefined) stepPayload.summary = stepSummary;
      send('step', stepPayload);

      if (step.type === 'tool_invocation') {
        const inv = step as ToolInvocationStep;
        send('tool_start', {
          stepId: step.id,
          stepIndex: step.index,
          toolNames: inv.invocations.map((i) => i.toolName),
          startedAt,
        });
      }

      if (step.type === 'tool_result') {
        const res = step as ToolResultStep;
        send('tool_result', {
          stepId: step.id,
          stepIndex: step.index,
          toolNames: res.results.map((r) => r.toolName),
          ok: res.results.map((r) => r.ok),
          finishedAt: finishedAt ?? startedAt,
        });
      }
    },

    onRunFinished(result: AgentRunResult): void {
      send('done', {
        runId: result.runId,
        status: result.status,
        terminationReason: result.terminationReason,
        finalAnswer: result.finalAnswer != null ? { content: result.finalAnswer.content } : undefined,
        error: result.error,
      });
    },
  };
}
