// src/routes/index.ts

import { Hono } from 'hono';
import health from './health';
import { createRunRoutes } from './run';
import type { AgentDeps } from './types';

export function createApp(deps: AgentDeps): Hono {
  const app = new Hono();

  app.route('/', health);
  app.route('/', createRunRoutes(deps));

  return app;
}

export type { AgentDeps } from './types';
