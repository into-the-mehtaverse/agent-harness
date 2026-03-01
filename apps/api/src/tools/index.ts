// src/tools/index.ts

import type { Tool, ToolDefinition, ToolContext, ToolInvocation, ToolResult, ToolError } from './types';
import type { ToolExecutor } from './executor';
import { toErrorMessage } from '../utils/error';
import { getBasicTools } from './basicTools';

/**
 * Return the default set of tools for the harness.
 * For now this is just the "basic" tools; we can extend later.
 */
export function getDefaultTools(): Tool[] {
  return getBasicTools();
}

/**
 * Create the default ToolExecutor that uses the registry and executeToolInvocations.
 * Later you can wrap this with SandboxedToolExecutor or GuardRailedToolExecutor.
 */
export function createDefaultToolExecutor(tools: Tool[]): ToolExecutor {
  const registry = buildToolRegistry(tools);
  return {
    async execute(invocations, ctx) {
      return executeToolInvocations(invocations, registry, ctx);
    },
  };
}

/**
 * Convenience function to extract the LLM-facing tool definitions
 * from a list of concrete Tool implementations.
 */
export function getToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((tool) => tool.definition);
}

/**
 * Build a simple name → Tool map for fast lookup during the agent loop.
 */
export function buildToolRegistry(tools: Tool[]): Map<string, Tool> {
  const map = new Map<string, Tool>();
  for (const tool of tools) {
    map.set(tool.definition.name, tool);
  }
  return map;
}

function makeErrorResult(
  invocation: ToolInvocation,
  error: ToolError,
  startedAt: Date,
  finishedAt: Date,
): ToolResult {
  return {
    callId: invocation.callId,
    toolName: invocation.toolName,
    ok: false,
    error,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

/**
 * Execute a single ToolInvocation against a registry of tools,
 * converting thrown errors into structured ToolResult objects.
 */
export async function executeToolInvocation(
  invocation: ToolInvocation,
  registry: Map<string, Tool>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const startedAt = ctx.now();
  const tool = registry.get(invocation.toolName);

  if (!tool) {
    return makeErrorResult(
      invocation,
      {
        type: 'not_found',
        message: `Tool "${invocation.toolName}" is not registered`,
        retryable: false,
      },
      startedAt,
      ctx.now(),
    );
  }

  let argsToUse: unknown = invocation.args;
  if (tool.argsSchema) {
    const parsed = tool.argsSchema.safeParse(invocation.args);
    if (!parsed.success) {
      const finishedAt = ctx.now();
      const err = parsed.error;
      return makeErrorResult(
        invocation,
        {
          type: 'validation',
          message: err.message ?? 'Invalid arguments',
          retryable: false,
          details: err.issues?.length ? err.issues : undefined,
        },
        startedAt,
        finishedAt,
      );
    }
    argsToUse = parsed.data;
  }

  try {
    const data = await Promise.resolve(tool.handler(argsToUse, ctx));
    const finishedAt = ctx.now();

    return {
      callId: invocation.callId,
      toolName: invocation.toolName,
      ok: true,
      data,
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  } catch (err) {
    const finishedAt = ctx.now();
    return makeErrorResult(
      invocation,
      {
        type: 'execution',
        message: toErrorMessage(err, 'Unknown tool error'),
        retryable: false,
        details: err instanceof Error ? { stack: err.stack } : undefined,
      },
      startedAt,
      finishedAt,
    );
  }
}

/**
 * Execute many ToolInvocations in parallel using the same registry and context.
 */
export async function executeToolInvocations(
  invocations: ToolInvocation[],
  registry: Map<string, Tool>,
  ctx: ToolContext,
): Promise<ToolResult[]> {
  return Promise.all(
    invocations.map((invocation) =>
      executeToolInvocation(invocation, registry, ctx),
    ),
  );
}

export type { ToolExecutor } from './executor';
