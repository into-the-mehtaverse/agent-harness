// src/server.ts

import 'dotenv/config';

import { getConfig } from './config';
import { OpenAIClient } from './llm/client';
import {
  getDefaultTools,
  getToolDefinitions,
  createDefaultToolExecutor,
} from './tools';
import { ConsoleRunObserver } from './observability/consoleObserver';
import { createApp } from './routes';

const config = getConfig();
const llm = new OpenAIClient({
  ...(config.apiKey && { apiKey: config.apiKey }),
  ...(config.baseURL && { baseURL: config.baseURL }),
});
const tools = getDefaultTools();
const toolExecutor = createDefaultToolExecutor(tools);
const toolDefinitions = getToolDefinitions(tools);
const runObservers = [new ConsoleRunObserver()];

const deps = {
  config,
  model: config.model,
  llm,
  toolDefinitions,
  toolExecutor,
  runObservers,
};

const app = createApp(deps);

const port = Number(process.env.PORT) || 3000;

export default app;

const { serve } = await import('@hono/node-server');
serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${info.port}`);
});
