// src/agent/prompts.ts

import type { SystemMessage, UserMessage } from '../llm/types';
import type { AgentTask, AgentConfig } from './state';
import type { ToolDefinition } from '../tools/types';

/**
 * Default high-level system prompt for the agent.
 * We keep this small and generic; caller can override or extend.
 */
export const DEFAULT_SYSTEM_PROMPT_HEADER = `
You are a tool-using AI agent.
You must carefully read the user's request, decide whether tools are needed,
and call tools with correct, well-validated arguments when appropriate.
If tools are not needed, answer directly and concisely.
`.trim();

/**
 * Render a short, LLM-readable description of the available tools.
 */
function describeToolsForSystemPrompt(tools: ToolDefinition[] | undefined): string {
  if (!tools || tools.length === 0) {
    return 'No tools are available in this run.';
  }

  const rendered = tools
    .map((tool) => {
      const desc = tool.description ?? 'No description provided.';
      return `- ${tool.name}: ${desc}`;
    })
    .join('\n');

  return `You have access to the following tools:\n${rendered}`;
}

/**
 * Build the system message given the task, config, and tools.
 * This is where we can encode high-level behavior rules.
 */
export function buildSystemMessage(params: {
  task: AgentTask;
  config: AgentConfig;
  tools?: ToolDefinition[];
}): SystemMessage {
  const { task, tools } = params;

  const toolSection = describeToolsForSystemPrompt(tools);

  const content = [
    DEFAULT_SYSTEM_PROMPT_HEADER,
    '',
    `Your task id is "${task.id}".`,
    toolSection,
    '',
    'General rules:',
    '- Think step-by-step and keep reasoning concise.',
    '- Use tools when they are necessary to complete the task or to fetch up-to-date/structured data.',
    '- Validate tool arguments before calling tools.',
    '- After using tools, reflect on their results and decide the next best action.',
    '- If you cannot complete the task with the available tools and information, explain clearly why.',
  ]
    .join('\n')
    .trim();

  return {
    role: 'system',
    content,
  };
}

/**
 * Build the initial user message from the AgentTask.
 * This keeps the user-facing description separate from the system instructions.
 */
export function buildInitialUserMessage(task: AgentTask): UserMessage {
  const lines: string[] = [`Task: ${task.description}`];

  if (task.input !== undefined) {
    lines.push('', 'Structured input:', JSON.stringify(task.input, null, 2));
  }

  return {
    role: 'user',
    content: lines.join('\n'),
  };
}

/**
 * Convenience helper that returns both system and user messages
 * to seed a new agent run.
 */
export function buildInitialMessages(params: {
  task: AgentTask;
  config: AgentConfig;
  tools?: ToolDefinition[];
}): { system: SystemMessage; user: UserMessage } {
  const system = buildSystemMessage(params);
  const user = buildInitialUserMessage(params.task);
  return { system, user };
}
