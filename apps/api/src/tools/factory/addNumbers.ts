// src/tools/factory/addNumbers.ts

import type { Tool, ToolContext } from '../types';

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
