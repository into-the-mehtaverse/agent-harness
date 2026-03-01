// src/llm/client.ts

import OpenAI from 'openai';
import type { Reasoning as OpenAIReasoning } from 'openai/resources/shared.js';
import type {
  Response,
  ResponseStreamEvent,
  ResponseFunctionToolCall,
  ResponseInputItem,
  EasyInputMessage,
  FunctionTool,
} from 'openai/resources/responses/responses.js';
import type {
  ChatCompletionParams,
  ChatCompletionResponse,
  LLMClient,
  LLMMessage,
  AssistantMessage,
  ToolMessage,
  LLMToolCall,
  StreamChunk,
  LLMTokenUsage,
  ReasoningConfig,
} from './types';
import type { ToolDefinition } from '../tools/types';

/**
 * Build instructions and input for the Responses API.
 * When previousResponseOutput is provided (reasoning models + function calling), we pass
 * user messages, then the full previous output (reasoning + message + function_calls),
 * then the new tool results, so the model keeps reasoning context. See OpenAI docs:
 * "Keeping reasoning items in context".
 */
function messagesToInstructionsAndInput(
  messages: LLMMessage[],
  previousResponseOutput?: unknown[],
): { instructions: string | null; input: ResponseInputItem[] } {
  const systemParts: string[] = [];
  const userItems: ResponseInputItem[] = [];
  const toolItems: ResponseInputItem[] = [];

  if (previousResponseOutput != null && previousResponseOutput.length > 0) {
    const definedMessages = messages.filter(
      (m): m is LLMMessage => m != null,
    );
    for (const msg of definedMessages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else if (msg.role === 'user') {
        const content =
          typeof (msg as { content: unknown }).content === 'string'
            ? (msg as { content: string }).content
            : '';
        userItems.push({ role: 'user', content } as EasyInputMessage);
      } else if (msg.role === 'tool') {
        const toolMsg = msg as ToolMessage;
        toolItems.push({
          type: 'function_call_output',
          call_id: toolMsg.toolCallId,
          output: toolMsg.content,
        });
      }
    }
    const instructions =
      systemParts.length > 0 ? systemParts.join('\n\n') : null;
    const input: ResponseInputItem[] = [
      ...userItems,
      ...(previousResponseOutput as ResponseInputItem[]),
      ...toolItems,
    ];
    return { instructions, input };
  }

  const input: ResponseInputItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg == null) continue;
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }
    if (msg.role === 'tool') {
      const toolMsg = msg as ToolMessage;
      input.push({
        type: 'function_call_output',
        call_id: toolMsg.toolCallId,
        output: toolMsg.content,
      });
      continue;
    }
    if (msg.role === 'user') {
      const content =
        typeof (msg as { content: unknown }).content === 'string'
          ? (msg as { content: string }).content
          : '';
      input.push({ role: 'user', content } as EasyInputMessage);
      continue;
    }
    if (msg.role === 'assistant') {
      const assistant = msg as AssistantMessage;
      const content =
        typeof assistant.content === 'string' ? assistant.content : '';
      input.push({ role: 'assistant', content } as EasyInputMessage);
      if (assistant.toolCalls && assistant.toolCalls.length > 0) {
        for (const tc of assistant.toolCalls) {
          input.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          });
        }
        for (let j = 0; j < assistant.toolCalls.length; j++) {
          const nextMsg = messages[i + 1 + j];
          if (nextMsg?.role === 'tool') {
            const toolMsg = nextMsg as ToolMessage;
            input.push({
              type: 'function_call_output',
              call_id: toolMsg.toolCallId,
              output: toolMsg.content,
            });
          }
        }
        i += assistant.toolCalls.length;
      }
      continue;
    }
  }

  const instructions =
    systemParts.length > 0 ? systemParts.join('\n\n') : null;
  return { instructions, input };
}

function toResponseTools(
  tools: ToolDefinition[] | undefined,
): FunctionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description ?? null,
    parameters: (tool.parameters ?? {}) as Record<string, unknown>,
    strict: true,
  }));
}

function toResponseToolChoice(
  toolChoice: ChatCompletionParams['toolChoice'],
): 'auto' | 'none' | { type: 'function'; name: string } | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice === 'auto' || toolChoice === 'none') return toolChoice;
  return { type: 'function', name: toolChoice.name };
}

function toResponseReasoning(
  reasoning: ReasoningConfig | undefined,
): OpenAIReasoning | undefined {
  if (!reasoning) return undefined;
  const effort =
    reasoning.effort != null
      ? (reasoning.effort as OpenAIReasoning['effort'])
      : undefined;
  const summary = reasoning.summary ?? undefined;
  if (effort === undefined && summary === undefined) return undefined;
  return { ...(effort !== undefined && { effort }), ...(summary !== undefined && { summary }) };
}

function responseToAssistantMessage(response: Response): AssistantMessage {
  const content = response.output_text ?? '';

  const toolCallsRaw = (response.output ?? []).filter(
    (item): item is ResponseFunctionToolCall =>
      (item as { type?: string }).type === 'function_call',
  );
  const toolCalls: LLMToolCall[] | undefined =
    toolCallsRaw.length > 0
      ? toolCallsRaw.map((fc) => ({
          id: fc.call_id ?? fc.id ?? '',
          name: fc.name ?? '',
          arguments: fc.arguments ?? '',
        }))
      : undefined;

  return {
    role: 'assistant',
    content,
    toolCalls,
  };
}

function responseUsageToLLMUsage(
  usage: Response['usage'],
): LLMTokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.input_tokens ?? 0,
    completionTokens: usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

/**
 * OpenAI-backed implementation of our provider-agnostic LLMClient.
 * Uses the Responses API (client.responses.create) instead of Chat Completions.
 */
export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(config?: { apiKey?: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config?.baseURL,
    });

    if (!this.client.apiKey) {
      throw new Error(
        'OpenAIClient: OPENAI_API_KEY is not set. Set it in the environment or pass it explicitly.',
      );
    }
  }

  async chat(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const { model, messages, timeoutMs, reasoning, previousResponseOutput } =
      params;
    const { instructions, input } = messagesToInstructionsAndInput(
      messages,
      previousResponseOutput,
    );
    const tools = toResponseTools(params.tools);
    const tool_choice = toResponseToolChoice(params.toolChoice);
    const reasoningParam = toResponseReasoning(reasoning);

    const body: Parameters<OpenAI['responses']['create']>[0] = {
      model,
      ...(instructions != null && { instructions }),
      ...(input.length > 0 && { input }),
      ...(tools && tools.length > 0 && { tools }),
      ...(tool_choice !== undefined && { tool_choice }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.maxTokens !== undefined && {
        max_output_tokens: params.maxTokens,
      }),
      ...(params.topP !== undefined && { top_p: params.topP }),
      ...(reasoningParam && { reasoning: reasoningParam }),
    };

    const response = (await this.client.responses.create(
      body,
      timeoutMs ? { timeout: timeoutMs } : undefined,
    )) as Response;

    const message = responseToAssistantMessage(response);
    const usage = responseUsageToLLMUsage(response.usage);

    return {
      message,
      ...(usage && { usage }),
      raw: response,
    };
  }

  async *chatStream(params: ChatCompletionParams): AsyncIterable<StreamChunk> {
    const { model, messages, timeoutMs, reasoning, previousResponseOutput } =
      params;
    const { instructions, input } = messagesToInstructionsAndInput(
      messages,
      previousResponseOutput,
    );
    const tools = toResponseTools(params.tools);
    const tool_choice = toResponseToolChoice(params.toolChoice);
    const reasoningParam = toResponseReasoning(reasoning);

    const body: Parameters<OpenAI['responses']['create']>[0] = {
      model,
      stream: true,
      ...(instructions != null && { instructions }),
      ...(input.length > 0 && { input }),
      ...(tools && tools.length > 0 && { tools }),
      ...(tool_choice !== undefined && { tool_choice }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.maxTokens !== undefined && {
        max_output_tokens: params.maxTokens,
      }),
      ...(params.topP !== undefined && { top_p: params.topP }),
      ...(reasoningParam && { reasoning: reasoningParam }),
    };

    const stream = await this.client.responses.create(
      body,
      timeoutMs ? { timeout: timeoutMs } : undefined,
    );

    let content = '';
    let usage: LLMTokenUsage | undefined;
    const toolCallsAccum: Array<{ id: string; name: string; arguments: string }> =
      [];

    for await (const event of stream as AsyncIterable<ResponseStreamEvent>) {
      switch (event.type) {
        case 'response.output_text.delta':
          if (event.delta) {
            content += event.delta;
            yield { contentDelta: event.delta };
          }
          break;
        case 'response.reasoning_text.delta':
          if (event.delta) {
            yield { reasoningDelta: event.delta };
          }
          break;
        case 'response.function_call_arguments.delta': {
          const idx = event.output_index ?? 0;
          if (!toolCallsAccum[idx]) {
            toolCallsAccum[idx] = {
              id: event.item_id ?? '',
              name: '',
              arguments: '',
            };
          }
          if (event.item_id != null) toolCallsAccum[idx].id = event.item_id;
          if (event.delta) toolCallsAccum[idx].arguments += event.delta;
          break;
        }
        case 'response.function_call_arguments.done': {
          const idx = event.output_index ?? 0;
          if (!toolCallsAccum[idx]) {
            toolCallsAccum[idx] = {
              id: event.item_id ?? '',
              name: event.name ?? '',
              arguments: event.arguments ?? '',
            };
          } else {
            if (event.item_id != null) toolCallsAccum[idx].id = event.item_id;
            if (event.name != null) toolCallsAccum[idx].name = event.name;
            if (event.arguments != null)
              toolCallsAccum[idx].arguments = event.arguments;
          }
          break;
        }
        case 'response.completed': {
          const completedEvent = event as {
            type: 'response.completed';
            response: Response;
          };
          const res = completedEvent.response as Response;
          usage = responseUsageToLLMUsage(res.usage);
          const fromRes = responseToAssistantMessage(res);
          const toolCalls: LLMToolCall[] | undefined =
            toolCallsAccum.length > 0 ? toolCallsAccum : fromRes.toolCalls;
          const message: AssistantMessage = {
            role: 'assistant',
            content: content || fromRes.content,
            toolCalls,
          };
          yield {
            done: true,
            message,
            ...(usage && { usage }),
            raw: res,
          };
          return;
        }
        default:
          break;
      }
    }

    const toolCalls: LLMToolCall[] | undefined =
      toolCallsAccum.length > 0 ? toolCallsAccum : undefined;
    const message: AssistantMessage = {
      role: 'assistant',
      content,
      toolCalls,
    };
    yield { done: true, message, ...(usage && { usage }) };
  }
}
