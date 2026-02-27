// src/llm/client.ts

import OpenAI from 'openai';
import type {
  ChatCompletionParams,
  ChatCompletionResponse,
  LLMClient,
  LLMMessage,
  AssistantMessage,
  ToolMessage,
  LLMToolCall,
} from './types';
import type { ToolDefinition } from '../tools/types';

function toOpenAIMessage(msg: LLMMessage): OpenAI.Chat.ChatCompletionMessageParam {
  if (msg.role === 'tool') {
    const toolMsg = msg as ToolMessage;
    return {
      role: 'tool',
      content: toolMsg.content,
      tool_call_id: toolMsg.toolCallId,
    };
  }

  if (msg.role === 'assistant') {
    const assistant = msg as AssistantMessage;
    return {
      role: 'assistant',
      content: assistant.content,
      // OpenAI types expect `tool_calls` to be omitted or a non-undefined array.
      ...(assistant.toolCalls &&
        assistant.toolCalls.length > 0 && {
          tool_calls: assistant.toolCalls.map((tc: LLMToolCall) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        }),
    };
  }

  // system / user are 1:1
  return {
    role: msg.role,
    content: msg.content,
  } as OpenAI.Chat.ChatCompletionMessageParam;
}

function fromOpenAIAssistantMessage(
  msg: OpenAI.Chat.ChatCompletionMessage,
): AssistantMessage {
  const toolCalls: LLMToolCall[] | undefined = msg.tool_calls
    ?.map((tc: any) => {
      if (!tc || !tc.function) return undefined;
      return {
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      } as LLMToolCall;
    })
    .filter((tc): tc is LLMToolCall => Boolean(tc));

  const content = typeof msg.content === 'string' ? msg.content : '';

  return {
    role: 'assistant',
    content,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
}

function toOpenAITools(
  tools: ToolDefinition[] | undefined,
): OpenAI.Chat.ChatCompletionTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.parameters as any,
    },
  }));
}

function toOpenAIToolChoice(
  toolChoice: ChatCompletionParams['toolChoice'],
): OpenAI.Chat.ChatCompletionToolChoiceOption | undefined {
  if (!toolChoice) return undefined;
  if (toolChoice === 'auto' || toolChoice === 'none') return toolChoice;

  // Force a specific function tool
  return {
    type: 'function',
    function: { name: toolChoice.name },
  };
}

/**
 * OpenAI-backed implementation of our provider-agnostic LLMClient.
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
    const {
      model,
      messages,
      tools,
      toolChoice,
      timeoutMs,
    } = params;

    const openaiMessages = messages.map(toOpenAIMessage);
    const openaiTools = toOpenAITools(tools);
    const openaiToolChoice = toOpenAIToolChoice(toolChoice);

    const response = await this.client.chat.completions.create(
      {
        model,
        messages: openaiMessages,
        ...(openaiTools && { tools: openaiTools }),
        ...(openaiToolChoice !== undefined && { tool_choice: openaiToolChoice }),
        // Map optional parameters only when defined to satisfy
        // `exactOptionalPropertyTypes` and OpenAI's `null` semantics.
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.maxTokens !== undefined && {
          max_tokens: params.maxTokens ?? null,
        }),
        ...(params.topP !== undefined && { top_p: params.topP }),
        ...(params.stop !== undefined && { stop: params.stop }),
      },
      timeoutMs ? { timeout: timeoutMs } : undefined,
    );

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new Error('OpenAIClient: no choices returned from chat.completions.create');
    }

    const assistantMessage = fromOpenAIAssistantMessage(choice.message);

    const usage =
      response.usage &&
      ({
        promptTokens: response.usage.prompt_tokens ?? 0,
        completionTokens: response.usage.completion_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } as const);

    const result: ChatCompletionResponse = {
      message: assistantMessage,
      ...(usage && { usage }),
      raw: response,
    };

    return result;
  }
}
