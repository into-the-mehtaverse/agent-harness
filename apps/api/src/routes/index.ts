// src/routes/index.ts

import { Hono } from 'hono';
import health from './health';
import { createRunRoutes } from './run';
import { createRunStreamRoutes } from './runStream';
import type { AgentDeps } from './types';

export function createApp(deps: AgentDeps): Hono {
  const app = new Hono();

  app.route('/', health);
  app.route('/', createRunRoutes(deps));
  app.route('/', createRunStreamRoutes(deps));

  return app;
}

export type { AgentDeps } from './types';
