// src/agent/context.ts

import type { SystemMessage, UserMessage } from '../llm/types';
import type { AgentTask, AgentConfig } from './state';
import type { ToolDefinition } from '../tools/types';
import { buildInitialMessages } from './prompts';

export interface ContextPreparator {
  prepare(params: {
    task: AgentTask;
    config: AgentConfig;
    tools: ToolDefinition[];
  }): { system: SystemMessage; user: UserMessage };
}

/**
 * Default implementation: delegates to buildInitialMessages from prompts.
 * Later you can add MemoryAwareContextPreparator or RAGContextPreparator.
 */
export function createDefaultContextPreparator(): ContextPreparator {
  return {
    prepare(params) {
      return buildInitialMessages(params);
    },
  };
}
