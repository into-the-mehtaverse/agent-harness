// src/index.ts

import 'dotenv/config';

import { OpenAIClient } from './llm/client';
import type { LLMModelId } from './llm/types';
import { getDefaultTools } from './tools';
import type { AgentTask, AgentConfig } from './agent/state';
import { runAgentLoop } from './agent/loop';

async function main() {
  const model: LLMModelId =
    (process.env.OPENAI_MODEL as LLMModelId) ??
    (process.env.OPEN_AI_MODEL as LLMModelId) ??
    'gpt-4.1-mini';

  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API_KEY ?? undefined;
  const baseURL = process.env.OPENAI_BASE_URL ?? undefined;

  const llm = new OpenAIClient({
    ...(apiKey && { apiKey }),
    ...(baseURL && { baseURL }),
  });

  const tools = getDefaultTools();

  const descriptionFromCli = process.argv.slice(2).join(' ');
  const task: AgentTask = {
    id: `task-${Date.now()}`,
    description:
      descriptionFromCli ||
      'You are a demo agent. Say hello, then (optionally) use tools to show what you can do.',
  };

  const config: AgentConfig = {
    maxSteps: 8,
    maxToolCalls: 6,
    modelCallTimeoutMs: 60_000,
    toolCallTimeoutMs: 10_000,
    allowNoToolAnswer: true,
    metadata: {
      model,
    },
  };

  const result = await runAgentLoop({
    task,
    config,
    model,
    llm,
    tools,
  });

  // Simple stdout reporting for now.
  // We can later plug this into a proper logging / evaluation harness.
  // eslint-disable-next-line no-console
  console.log('=== Agent run summary ===');
  // eslint-disable-next-line no-console
  console.log('runId:', result.runId);
  // eslint-disable-next-line no-console
  console.log('status:', result.status);
  // eslint-disable-next-line no-console
  console.log('terminationReason:', result.terminationReason);
  // eslint-disable-next-line no-console
  console.log('totalToolCalls:', result.totalToolCalls);
  // eslint-disable-next-line no-console
  console.log('steps:', result.steps.length);

  if (result.finalAnswer) {
    // eslint-disable-next-line no-console
    console.log('\n=== Final answer ===\n');
    // eslint-disable-next-line no-console
    console.log(result.finalAnswer.content);
  } else if (result.error) {
    // eslint-disable-next-line no-console
    console.error('\n=== Error ===\n');
    // eslint-disable-next-line no-console
    console.error(result.error);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error in main:', err);
  process.exitCode = 1;
});
