// src/routes/runStream.ts
//
// POST /chat/stream: run the agent loop and stream progress as Server-Sent Events.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateTaskId } from '../utils/id';
import type { AgentTask, AgentConfig } from '../agent/state';
import { runAgentLoop } from '../agent/loop';
import { createSseRunObserver } from '../streaming/sse';
import type { AgentDeps } from './types';
import {
  type InitialChatMessage,
  lastUserMessageContent,
  parseInitialMessages,
} from './messageContext';

export function createChatStreamRoutes(deps: AgentDeps): Hono {
  const app = new Hono();
  const { config, model, llm, toolDefinitions, toolExecutor, runObservers } =
    deps;

  app.post('/chat/stream', async (c) => {
    let body: { messages?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error:
            'Invalid JSON body; expected { messages: Array<{ role, content }> }',
        },
        400,
      );
    }

    let initialMessages: InitialChatMessage[] | undefined;
    try {
      initialMessages = parseInitialMessages(body.messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid messages payload.';
      return c.json({ error: message }, 400);
    }
    if (!initialMessages || initialMessages.length === 0) {
      return c.json(
        { error: '`messages` is required and must include at least one message.' },
        400,
      );
    }

    const descriptionFromMessages = lastUserMessageContent(initialMessages);
    if (!descriptionFromMessages) {
      return c.json(
        { error: '`messages` must include at least one user message.' },
        400,
      );
    }

    const task: AgentTask = {
      id: generateTaskId(),
      description: descriptionFromMessages,
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
          initialMessages,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send('error', { message });
      }
    });
  });

  return app;
}
