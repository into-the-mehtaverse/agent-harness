// src/tools/factory/echo.ts

import { z } from 'zod';
import type { Tool, ToolContext } from '../types';

const echoArgsSchema = z.object({
  message: z.string().describe('The message to echo back.'),
});

/**
 * Simple "echo" tool: returns the same message back.
 */
export const echoTool: Tool = {
  definition: {
    name: 'echo',
    description: 'Echo back the provided message.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back.',
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
  },
  argsSchema: echoArgsSchema,
  async handler(args: unknown, ctx: ToolContext) {
    const { message } = args as { message: string };
    ctx.log?.('echo tool invoked', { message });
    return { message };
  },
};
