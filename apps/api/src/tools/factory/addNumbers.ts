// src/tools/factory/addNumbers.ts

import { z } from 'zod';
import type { Tool, ToolContext } from '../types';

const addNumbersArgsSchema = z.object({
  a: z.number().describe('First addend.'),
  b: z.number().describe('Second addend.'),
});

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
  argsSchema: addNumbersArgsSchema,
  async handler(args: unknown, ctx: ToolContext) {
    const { a, b } = args as { a: number; b: number };
    const sum = a + b;
    ctx.log?.('add_numbers tool invoked', { a, b, sum });
    return { a, b, sum };
  },
};
