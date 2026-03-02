"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";

const API_BASE = "/api";
const MAX_CONTEXT_MESSAGES = 24;

type ApiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function threadMessagesToApiMessages(
  messages: readonly ThreadMessage[],
): ApiChatMessage[] {
  const converted: ApiChatMessage[] = [];
  for (const m of messages) {
    if (m == null || (m.role !== "user" && m.role !== "assistant")) continue;
    const text = m.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
    if (!text) continue;
    converted.push({ role: m.role, content: text });
  }
  return converted.slice(-MAX_CONTEXT_MESSAGES);
}

/** Extract display text from done payload finalAnswer.content (array of parts or legacy string). */
function textFromDonePayload(payload: {
  finalAnswer?: { content?: unknown };
  error?: string;
}): string {
  if (payload.error) return payload.error;
  const content = payload.finalAnswer?.content;
  if (content == null) return "No response content.";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "No response content.";
  const parts = content as Array<{ type?: string; text?: string }>;
  const textParts = parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text);
  return textParts.length > 0 ? textParts.join("\n") : "No response content.";
}

/** Parse SSE stream and yield { event, data } for each message. */
async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: unknown }> {
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          currentData = line.slice(5).trim();
        } else if (line === "") {
          if (currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData) as unknown;
              yield { event: currentEvent, data };
            } catch {
              // skip malformed
            }
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const AgentRunAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const history = threadMessagesToApiMessages(messages);
    const hasUserMessage = history.some((m) => m.role === "user");
    if (!hasUserMessage) {
      yield { content: [{ type: "text" as const, text: "No message to send." }] };
      return;
    }

    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: abortSignal,
    });

    if (!res.ok) {
      const errorText = (await res.text()) || res.statusText || "Request failed";
      yield {
        content: [{ type: "text" as const, text: `Error: ${errorText}` }],
      };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield {
        content: [{ type: "text" as const, text: "No response body." }],
      };
      return;
    }

    let accumulatedText = "";

    for await (const msg of parseSSE(reader, abortSignal)) {
      if (msg.event === "text_delta") {
        const data = msg.data as { contentDelta?: string };
        if (data.contentDelta != null && data.contentDelta !== "") {
          accumulatedText += data.contentDelta;
          yield { content: [{ type: "text" as const, text: accumulatedText }] };
        }
      } else if (msg.event === "error") {
        const data = msg.data as { message?: string };
        yield {
          content: [{ type: "text" as const, text: `Error: ${data?.message ?? "Unknown error"}` }],
        };
        return;
      } else if (msg.event === "done") {
        const payload = msg.data as { finalAnswer?: { content?: unknown }; error?: string };
        const finalText = textFromDonePayload(payload);
        yield {
          content: [{ type: "text" as const, text: finalText.length > 0 ? finalText : accumulatedText }],
          status: { type: "complete" as const, reason: "stop" as const },
        };
        return;
      }
    }
  },
};

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(AgentRunAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </AssistantRuntimeProvider>
  );
}
