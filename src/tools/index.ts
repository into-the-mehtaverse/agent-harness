// src/tools/index.ts

import type { Tool, ToolDefinition, ToolContext, ToolInvocation, ToolResult } from './types';
import { getBasicTools } from './basicTools';

/**
 * Return the default set of tools for the harness.
 * For now this is just the "basic" tools; we can extend later.
 */
export function getDefaultTools(): Tool[] {
  return getBasicTools();
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
    return {
      callId: invocation.callId,
      toolName: invocation.toolName,
      ok: false,
      error: {
        type: 'not_found',
        message: `Tool "${invocation.toolName}" is not registered`,
        retryable: false,
      },
      startedAt,
      finishedAt: ctx.now(),
      durationMs: ctx.now().getTime() - startedAt.getTime(),
    };
  }

  try {
    const data = await Promise.resolve(tool.handler(invocation.args, ctx));
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
    const message =
      err instanceof Error ? err.message : `Unknown tool error: ${String(err)}`;

    return {
      callId: invocation.callId,
      toolName: invocation.toolName,
      ok: false,
      error: {
        type: 'execution',
        message,
        retryable: false,
        details: err instanceof Error ? { stack: err.stack } : undefined,
      },
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
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
