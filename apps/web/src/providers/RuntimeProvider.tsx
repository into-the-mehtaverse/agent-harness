"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";

const API_BASE = "/api";

function getLastUserText(messages: readonly ThreadMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m == null || m.role !== "user") continue;
    const text = m.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    if (text.trim()) return text;
  }
  return "";
}

const AgentRunAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    const description = getLastUserText(messages);
    if (!description) {
      return { content: [{ type: "text" as const, text: "No message to send." }] };
    }

    const res = await fetch(`${API_BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
      signal: abortSignal,
    });

    const data = await res.json();

    if (!res.ok) {
      const errorText = data.error ?? res.statusText ?? "Request failed";
      return {
        content: [{ type: "text" as const, text: `Error: ${errorText}` }],
      };
    }

    const text =
      data.finalAnswer?.content ?? data.error ?? "No response content.";
    return { content: [{ type: "text" as const, text }] };
  },
};

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(AgentRunAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
