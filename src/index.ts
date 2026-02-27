// src/index.ts

import 'dotenv/config';

import { getConfig } from './config';
import { OpenAIClient } from './llm/client';
import { generateTaskId } from './utils/id';
import { getDefaultTools, getToolDefinitions, createDefaultToolExecutor } from './tools';
import type { AgentTask, AgentConfig } from './agent/state';
import { runAgentLoop } from './agent/loop';
import { ConsoleRunObserver } from './observability/consoleObserver';

async function main() {
  const config = getConfig();

  const llm = new OpenAIClient({
    ...(config.apiKey && { apiKey: config.apiKey }),
    ...(config.baseURL && { baseURL: config.baseURL }),
  });

  const tools = getDefaultTools();
  const toolExecutor = createDefaultToolExecutor(tools);
  const toolDefinitions = getToolDefinitions(tools);

  const descriptionFromCli = process.argv.slice(2).join(' ');
  const task: AgentTask = {
    id: generateTaskId(),
    description:
      descriptionFromCli || config.defaultTaskDescription,
  };

  const agentConfig: AgentConfig = {
    maxSteps: config.defaultAgentConfig.maxSteps ?? 8,
    ...config.defaultAgentConfig,
    metadata: {
      ...config.defaultAgentConfig.metadata,
      model: config.model,
    },
  };

  const runObservers = [new ConsoleRunObserver()];

  await runAgentLoop({
    task,
    config: agentConfig,
    model: config.model,
    llm,
    toolDefinitions,
    toolExecutor,
    runObservers,
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error in main:', err);
  process.exitCode = 1;
});
