// src/llm/types.ts

import type { ToolDefinition } from '../tools/types';

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface BaseMessage {
  role: LLMRole;
  content: string;
}

/**
 * A tool call as returned by the model.
 * `arguments` is the raw JSON string; higher layers can parse/validate it.
 */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Message emitted by the assistant. It may include one or more tool calls.
 */
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  /**
   * When the model decides to call tools, it will populate this array.
   * When the model is just responding normally, this will be undefined.
   *
   * Note: we explicitly include `undefined` in the type because
   * `exactOptionalPropertyTypes` is enabled in tsconfig.
   */
  toolCalls?: LLMToolCall[] | undefined;
}

/**
 * Message representing the result of executing a tool.
 * This is what we feed back into the model so it can continue reasoning.
 */
export interface ToolMessage extends BaseMessage {
  role: 'tool';
  /**
   * Must match the `id` of the corresponding `LLMToolCall`.
   */
  toolCallId: string;
}

export interface UserMessage extends BaseMessage {
  role: 'user';
}

export interface SystemMessage extends BaseMessage {
  role: 'system';
}

export type LLMMessage =
  | AssistantMessage
  | ToolMessage
  | UserMessage
  | SystemMessage;

/**
 * Basic model identifier alias. We keep it as string so the harness
 * can work with any provider/model name.
 */
export type LLMModelId = string;

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Parameters for a single non-streaming chat completion call.
 */
export interface ChatCompletionParams {
  model: LLMModelId;
  messages: LLMMessage[];
  /**
   * Tools the model is allowed to call, described using our
   * shared `ToolDefinition` type. The provider adapter will
   * convert this into whatever shape the API expects.
   */
  tools?: ToolDefinition[];
  /**
   * 'auto' = let the model decide; 'none' = no tools; or force a specific tool.
   */
  toolChoice?: 'auto' | 'none' | { type: 'tool'; name: string };
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string | string[];
  /**
   * Optional per-call metadata (e.g. requestId, experiment tags).
   */
  metadata?: Record<string, unknown>;
  /**
   * Optional timeout in milliseconds for the provider call.
   */
  timeoutMs?: number;
}

/**
 * Normalized response from the model for a non-streaming chat completion.
 */
export interface ChatCompletionResponse {
  message: LLMMessage;
  /**
   * Token usage for this call, if reported by the provider.
   * Optional and explicitly includes `undefined` to play well
   * with `exactOptionalPropertyTypes`.
   */
  usage?: LLMTokenUsage | undefined;
  /**
   * Provider-specific raw response, if the caller needs to inspect it.
   */
  raw?: unknown;
}

/**
 * One chunk of a streamed chat response.
 * - contentDelta: incremental text (reasoning or final answer).
 * - done: when true, the stream is complete and message/usage are the final result.
 */
export interface StreamChunk {
  contentDelta?: string;
  done?: true;
  message?: AssistantMessage;
  usage?: LLMTokenUsage;
}

/**
 * Provider-agnostic client interface that the rest of the harness depends on.
 * `src/llm/client.ts` will implement this for OpenAI.
 * Optional chatStream: when present, the runner can stream tokens to the user.
 */
export interface LLMClient {
  chat(params: ChatCompletionParams): Promise<ChatCompletionResponse>;
  chatStream?(params: ChatCompletionParams): AsyncIterable<StreamChunk>;
}
