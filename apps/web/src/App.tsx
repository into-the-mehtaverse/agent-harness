import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

const API_BASE = "/api";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${data.error ?? res.statusText}`,
          },
        ]);
        return;
      }

      const reply =
        data.finalAnswer?.content ?? data.error ?? "No response content.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Request failed: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-neutral-800">
          Agent Harness — Chat
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-neutral-500">
            Send a message to start. The agent can use tools when needed.
          </p>
        )}
        <ul className="space-y-4">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg bg-blue-600 px-4 py-2 text-white"
                  : "mr-auto max-w-[85%] rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-neutral-200"
              }
            >
              <span className="text-xs font-medium text-neutral-400">
                {m.role === "user" ? "You" : "Assistant"}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{m.content}</p>
            </li>
          ))}
        </ul>
        {loading && (
          <p className="mt-2 text-sm text-neutral-400">Thinking…</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-neutral-200 bg-white p-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
