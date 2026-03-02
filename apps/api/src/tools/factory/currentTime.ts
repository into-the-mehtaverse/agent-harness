// src/tools/factory/currentTime.ts

import { z } from 'zod';
import type { Tool, ToolContext } from '../types';

const currentTimeArgsSchema = z.object({});

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
  argsSchema: currentTimeArgsSchema,
  async handler(_args: unknown, ctx: ToolContext) {
    const now = ctx.now();
    const iso = now.toISOString();
    ctx.log?.('get_current_time tool invoked', { iso });
    return { iso };
  },
};
