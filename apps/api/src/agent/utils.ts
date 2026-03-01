// src/agent/utils.ts

import type { LLMToolCall } from '../llm/types';
import type { ToolInvocation } from '../tools/types';

/**
 * Normalize tool name from API (e.g. "functions.get_current_time" → "get_current_time")
 * so registry lookup matches our tool definitions.
 */
function normalizeToolName(name: string): string {
  if (name.startsWith('functions.')) {
    return name.slice('functions.'.length);
  }
  return name;
}

/**
 * Convert LLM tool calls (from an assistant message) into ToolInvocation objects.
 * Parses JSON arguments; on parse failure, passes { _raw: arguments } so the tool can error.
 */
export function toolCallsToInvocations(
  toolCalls: LLMToolCall[],
  stepIndex: number,
): ToolInvocation[] {
  return toolCalls.map((tc, idx) => {
    let parsedArgs: unknown;
    try {
      parsedArgs = tc.arguments ? JSON.parse(tc.arguments) : {};
    } catch {
      parsedArgs = { _raw: tc.arguments };
    }

    return {
      callId: tc.id || `toolcall-${stepIndex}-${idx}`,
      toolName: normalizeToolName(tc.name || ''),
      args: parsedArgs,
    };
  });
}

/**
 * Returns a logger function suitable for ToolContext.log.
 * Used only by the agent loop when building ToolContext.
 */
export function createToolLogger(): (
  message: string,
  fields?: Record<string, unknown>,
) => void {
  return (message: string, fields?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.log('[tool]', message, fields ?? {});
  };
}
