// src/agent/context.ts

import type { SystemMessage, UserMessage, AssistantMessage } from '../llm/types';
import type { AgentTask, AgentConfig } from './state';
import type { ToolDefinition } from '../tools/types';
import { buildInitialMessages } from './prompts';

export interface ContextPreparator {
  prepare(params: {
    task: AgentTask;
    config: AgentConfig;
    tools: ToolDefinition[];
    initialMessages?: Array<UserMessage | AssistantMessage>;
  }): {
    system: SystemMessage;
    user: UserMessage;
    initialMessages?: Array<UserMessage | AssistantMessage>;
  };
}

/**
 * Default implementation: delegates to buildInitialMessages from prompts.
 * Later you can add MemoryAwareContextPreparator or RAGContextPreparator.
 */
export function createDefaultContextPreparator(): ContextPreparator {
  return {
    prepare(params) {
      const { system, user } = buildInitialMessages(params);
      return {
        system,
        user,
        ...(params.initialMessages !== undefined && {
          initialMessages: params.initialMessages,
        }),
      };
    },
  };
}
