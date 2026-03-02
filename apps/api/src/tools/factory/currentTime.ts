// src/tools/factory/currentTime.ts

import type { Tool, ToolContext } from '../types';

/**
 * Returns the current time in ISO 8601 format.
 */
export const currentTimeTool: Tool = {
  definition: {
    name: 'get_current_time',
    description: 'Get the current time in ISO 8601 format.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  async handler(_args: unknown, ctx: ToolContext) {
    const now = ctx.now();
    const iso = now.toISOString();
    ctx.log?.('get_current_time tool invoked', { iso });
    return { iso };
  },
};
