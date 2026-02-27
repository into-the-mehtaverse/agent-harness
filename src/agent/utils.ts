// src/agent/utils.ts

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
