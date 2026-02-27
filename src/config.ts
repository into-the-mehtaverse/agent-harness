// src/config.ts

import type { AgentConfig } from './agent/state';

export interface AppConfig {
  model: string;
  apiKey: string | undefined;
  baseURL: string | undefined;
  defaultAgentConfig: Partial<AgentConfig>;
  defaultTaskDescription: string;
}

const DEFAULT_TASK_DESCRIPTION =
  'You are a demo agent. Say hello, then (optionally) use tools to show what you can do.';

export function getConfig(): AppConfig {
  const model =
    process.env.OPENAI_MODEL ??
    process.env.OPEN_AI_MODEL ??
    'gpt-4.1-mini';

  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.OPEN_AI_API_KEY ?? undefined;
  const baseURL = process.env.OPENAI_BASE_URL ?? undefined;

  const defaultAgentConfig: Partial<AgentConfig> = {
    maxSteps: 8,
    maxToolCalls: 6,
    modelCallTimeoutMs: 60_000,
    toolCallTimeoutMs: 10_000,
    allowNoToolAnswer: true,
  };

  return {
    model,
    apiKey,
    baseURL,
    defaultAgentConfig,
    defaultTaskDescription: DEFAULT_TASK_DESCRIPTION,
  };
}
