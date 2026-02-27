# Agent Harness — Goals & Roadmap

## Goals

- **Learn agents by building.** This repo is a hands-on lab for understanding how agentic systems work: loops, tools, state, context, and observability.
- **Become an expert agent builder.** The aim is to master the full stack of reasoning, memory, tools, safety, and evaluation—not just get something running.
- **Keep the codebase modular and maintainable.** New features (RAG, memory, sandboxing, more tools, websockets, harness, observability) should plug in without big refactors.

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
