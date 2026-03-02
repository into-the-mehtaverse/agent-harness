import type { AssistantMessage, UserMessage } from '../llm/types';

export type InitialChatMessage = UserMessage | AssistantMessage;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * Validate and normalize incoming chat history messages from API payload.
 */
export function parseInitialMessages(raw: unknown): InitialChatMessage[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error('`messages` must be an array when provided.');
  }

  const parsed: InitialChatMessage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = asRecord(raw[i]);
    if (!item) {
      throw new Error(`messages[${i}] must be an object.`);
    }
    const role = item.role;
    const content = item.content;
    if (role !== 'user' && role !== 'assistant') {
      throw new Error(`messages[${i}].role must be "user" or "assistant".`);
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error(`messages[${i}].content must be a non-empty string.`);
    }
    parsed.push({ role, content });
  }
  return parsed;
}

export function lastUserMessageContent(messages: InitialChatMessage[] | undefined): string | undefined {
  if (!messages || messages.length === 0) return undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message) continue;
    if (message.role === 'user') return message.content;
  }
  return undefined;
}
