# Agent Harness — Goals & Roadmap

## Goals

- **Learn agents by building.** This repo is a hands-on lab for understanding how agentic systems work: loops, tools, state, context, and observability.
- **Become an expert agent builder.** The aim is to master the full stack of reasoning, memory, tools, safety, and evaluation—not just get something running.
- **Keep the codebase modular and maintainable.** New features (RAG, memory, sandboxing, more tools, websockets, harness, observability) should plug in without big refactors.

---

## Completed items

- **Structured tool args (Zod)** — Each tool in `tools/factory/` defines an `argsSchema`; the executor validates before running the handler and returns a clear validation error to the model on failure.
- **Tool factory layout** — Tools live under `tools/factory/` with one file per tool (echo, currentTime, addNumbers); `getBasicTools()` aggregates them.
- **SSE streaming for runs** — `POST /run/stream` streams events: `thinking`, `text_delta`, `tool_start`, `tool_result`, `step`, `done`, `error`. Agent loop notifies observers via `onStep` and `onStreamChunk`.
- **Frontend streams reply** — Chat adapter calls `/api/run/stream`, parses SSE, and uses an async generator to yield content so the assistant message streams into the UI as tokens arrive.
- **Observability hooks** — `RunObserver` supports `onRunFinished`, `onStreamChunk`, and `onStep`; used by the SSE observer and console observer.

---

## Roadmap: What to Explore & Build

### 1. Reasoning & planning
- **Scratchpad / chain-of-thought**: Let the model “think” in a dedicated field or tag before tool calls or final answer.
- **ReAct-style explicit reasoning**: Make the “reason” step visible in assistant messages (e.g. “I will call X because…”).
- **Planner / subgoal decomposition**: One model call that outputs a list of steps; main loop executes with that plan in context.
- **Reflection / self-critique**: A “critic” call after tool results or before final answer to check completeness and improve output.

### 2. Memory & context
- **Short-term**: Use `state.messages`; add **summarization** when nearing context limits.
- **Long-term**: In-run or cross-run **memory store** (key–value or facts) injected by the context preparator.
- **RAG**: Retriever (e.g. vector search) + context preparator injecting “Relevant context: …” into the system message.

### 3. Tools & environment
- **Structured tool args**: Validate tool arguments (e.g. Zod) from tool definitions; return clear errors to the model.
- **Sandboxing**: Run tool code in an isolated process with timeouts and restricted access.
- **Human-in-the-loop**: “Confirm” tool that pauses for user approval before continuing.
- **Dynamic tool choice**: Model or config selects which tools are available per run.

### 4. Observability & evaluation
- **Tracing**: Span-like events (step start/end, tool call, token usage) to a tracer or log.
- **Cost & latency**: Track tokens and time per step and per run; expose in result or observers.
- **Eval harness**: Dataset (task + expected behavior/rubric), run agent, scorer (exact match, LLM-as-judge, or tool-call correctness).
- **Regression tests**: Replay saved runs and compare steps or result.

### 5. Robustness & control
- **Retries**: Model calls (with backoff) and optional retries for retryable tool errors.
- **Timeouts**: Per-run and per-tool timeouts; integrate with cancellation.
- **Cancellation**: `AbortSignal` through the loop and into LLM client and executor.
- **Guardrails**: Pre/post checks on model output (e.g. block certain tools or arguments).

### 6. Multi-agent & orchestration (later)
- **Planner + executor**: Two agents—one plans, one executes tools.
- **Orchestrator**: Router that selects which agent or tool set handles a sub-task.

---

## Suggested build order

1. **Structured tool args (Zod)** — reliability and clear tool contracts.
2. **Eval harness** — dataset + scorer so we can measure progress.
3. **Scratchpad / planner** — explicit reasoning or a planner step.
4. **Memory (in-context)** — memory store + context preparator.
5. **Summarization / context management** — handle long conversations.
6. **Retries + AbortSignal + timeouts** — production robustness.
7. **RAG** — retriever + context preparator.
8. **Sandboxing or human-in-the-loop** — safety and control.


I think the path forward might be this, what are your thoughts.

1. Let's turn this into a node / hono backend.
2. We keep apps within agents/ within src to house the different agents (instead of apps/)
3. Same design as before, where the agents are instances of the harness.
4. If we want to go multi-agent, we can add an orchestrator on top of everything down the line.
5. We'll make this repo so that with one command, a vector db is spun up locally.
6. For now, we'll make this repo really good for local use. I'll create a simple but powerful frontend interface which lets me choose between the agents I have created and chat with them.

Later, if I want to use  This
