// src/routes/types.ts

import type { LLMClient } from '../llm/types';
import type { ToolDefinition } from '../tools/types';
import type { ToolExecutor } from '../tools/executor';
import type { RunObserver } from '../observability/types';
import type { AppConfig } from '../config';

export interface AgentDeps {
  config: AppConfig;
  model: string;
  llm: LLMClient;
  toolDefinitions: ToolDefinition[];
  toolExecutor: ToolExecutor;
  runObservers: RunObserver[];
}
