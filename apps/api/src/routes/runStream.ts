// src/routes/runStream.ts
//
// POST /run/stream: run the agent loop and stream progress as Server-Sent Events.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateTaskId } from '../utils/id';
import type { AgentTask, AgentConfig } from '../agent/state';
import { runAgentLoop } from '../agent/loop';
import { createSseRunObserver } from '../streaming/sse';
import type { AgentDeps } from './types';

export function createRunStreamRoutes(deps: AgentDeps): Hono {
  const app = new Hono();
  const { config, model, llm, toolDefinitions, toolExecutor, runObservers } =
    deps;

  app.post('/run/stream', async (c) => {
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

    return streamSSE(c, async (stream) => {
      const send = (event: string, data: unknown) => {
        stream.writeSSE({
          event,
          data: JSON.stringify(data),
        });
      };

      const sseObserver = createSseRunObserver(task.id, send);

      try {
        await runAgentLoop({
          task,
          config: agentConfig,
          model,
          llm,
          toolDefinitions,
          toolExecutor,
          runObservers: [...runObservers, sseObserver],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send('error', { message });
      }
    });
  });

  return app;
}
