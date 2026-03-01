// src/routes/run.ts

import { Hono } from 'hono';
import { generateTaskId } from '../utils/id';
import type { AgentTask, AgentConfig } from '../agent/state';
import { runAgentLoop } from '../agent/loop';
import type { AgentDeps } from './types';

export function createRunRoutes(deps: AgentDeps) {
  const app = new Hono();
  const { config, model, llm, toolDefinitions, toolExecutor, runObservers } =
    deps;

  app.post('/run', async (c) => {
    let body: { description?: string; input?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error:
            'Invalid JSON body; expected { description?: string, input?: unknown }',
        },
        400,
      );
    }

    const description =
      typeof body.description === 'string'
        ? body.description
        : config.defaultTaskDescription;

    const task: AgentTask = {
      id: generateTaskId(),
      description,
      ...(body.input !== undefined && { input: body.input }),
    };

    const agentConfig: AgentConfig = {
      maxSteps: config.defaultAgentConfig.maxSteps ?? 8,
      ...config.defaultAgentConfig,
      metadata: {
        ...config.defaultAgentConfig.metadata,
        model,
      },
    };

    try {
      const result = await runAgentLoop({
        task,
        config: agentConfig,
        model,
        llm,
        toolDefinitions,
        toolExecutor,
        runObservers,
      });

      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
