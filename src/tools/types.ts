// src/tools/types.ts

/**
 * Canonical tool name. We keep this as a string alias so we can
 * distinguish it from arbitrary strings in type signatures.
 */
export type ToolName = string;

/**
 * Schema for how the tool is presented to the LLM.
 * This is very similar to the OpenAI "function" tool schema.
 */
export interface ToolDefinition {
  name: ToolName;
  description?: string;
  /**
   * JSON Schema-like object describing the arguments.
   * We intentionally keep this as `unknown` so we don't couple
   * to a specific schema library.
   */
  parameters?: unknown;
}

/**
 * Raw invocation of a tool from the agent loop.
 * `args` should be the parsed JSON arguments.
 */
export interface ToolInvocation {
  /**
   * Stable identifier tying a tool call to a tool result.
   * Typically the `id` from the LLM's tool call.
   */
  callId: string;
  toolName: ToolName;
  args: unknown;
}

/**
 * Classification of tool errors. This makes it easy for the
 * agent loop to decide whether to retry or bail.
 */
export type ToolErrorType = 'validation' | 'not_found' | 'execution' | 'internal';

/**
 * Structured error from a tool execution.
 */
export interface ToolError {
  type: ToolErrorType;
  message: string;
  /**
   * Whether the agent loop may want to retry this invocation
   * (e.g. transient network failures).
   */
  retryable?: boolean;
  /**
   * Optional provider/tool-specific detail for debugging.
   */
  details?: unknown;
}

/**
 * Standardized result of executing a tool.
 */
export interface ToolResult {
  callId: string;
  toolName: ToolName;
  /**
   * If `ok` is false, `error` must be populated.
   */
  ok: boolean;
  /**
   * Arbitrary JSON-serializable payload returned by the tool.
   */
  data?: unknown;
  error?: ToolError;
  /**
   * Optional execution metadata.
   */
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  /**
   * Optional human-readable logs from the tool execution.
   */
  logs?: string[];
}

/**
 * Context passed to every tool invocation. This is where we hang
 * utilities that tools may need (clock, env, loggers, sandbox handles, etc.).
 * Keep this minimal for v1; we can extend later.
 */
export interface ToolContext {
  now: () => Date;
  /**
   * Environment/configuration for tools (e.g. API keys, base URLs).
   */
  env: Record<string, string | undefined>;
  /**
   * Simple logging hook; the harness can implement this however it likes.
   */
  log?: (message: string, fields?: Record<string, unknown>) => void;
}

/**
 * Function signature for a concrete tool implementation.
 */
export type ToolHandler = (
  args: unknown,
  ctx: ToolContext,
) => Promise<unknown> | unknown;

/**
 * Full tool object: the LLM-facing schema plus the executable handler.
 */
export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
  /**
   * Optional execution constraints specific to this tool.
   */
  timeoutMs?: number;
  maxRetries?: number;
}
