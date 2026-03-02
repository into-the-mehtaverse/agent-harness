// src/routes/index.ts

import { Hono } from 'hono';
import health from './health';
import { createChatStreamRoutes } from './runStream';
import type { AgentDeps } from './types';

export function createApp(deps: AgentDeps): Hono {
  const app = new Hono();

  app.route('/', health);
  app.route('/', createChatStreamRoutes(deps));

  return app;
}

export type { AgentDeps } from './types';
