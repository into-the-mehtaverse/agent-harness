// src/tools/basicTools.ts

import { z } from 'zod';
import type { Tool, ToolContext } from './types';

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

/**
 * Adds two numbers and returns the sum.
 */
export const addNumbersTool: Tool = {
  definition: {
    name: 'add_numbers',
    description: 'Add two numbers and return the result.',
    parameters: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First addend.',
        },
        b: {
          type: 'number',
          description: 'Second addend.',
        },
      },
      required: ['a', 'b'],
      additionalProperties: false,
    },
  },
  async handler(args: unknown, ctx: ToolContext) {
    const { a, b } = (args ?? {}) as { a?: unknown; b?: unknown };

    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('add_numbers: "a" and "b" must both be numbers');
    }

    const sum = a + b;
    ctx.log?.('add_numbers tool invoked', { a, b, sum });
    return { a, b, sum };
  },
};

/**
 * Convenience helper to get a basic tool set.
 */
export function getBasicTools(): Tool[] {
  return [echoTool, currentTimeTool, addNumbersTool];
}
