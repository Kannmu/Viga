import type {
  ModelConfig,
  OpenAIChatCompletionResponse,
  OpenAIMessage,
  OpenAITool,
  OpenAIToolChoice,
  OpenAIToolCall,
  OpenAIResponsesFunctionCall,
  OpenAIResponsesResponse,
  StreamChunk,
  ToolCallingProgressEvent,
} from './types';

export class APIError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export class OpenAICompatibleClient {
  private static readonly MAX_TOOL_TURNS = 100;

  constructor(
    private readonly getApiKey: (profileId: string) => Promise<string>,
    private readonly requestFetch: typeof fetch = fetch,
  ) {}

  async createChatCompletion(
    config: ModelConfig,
    payload: {
      messages: OpenAIMessage[];
      tools?: OpenAITool[];
      toolChoice?: OpenAIToolChoice;
      stream?: boolean;
    },
  ): Promise<OpenAIChatCompletionResponse> {
    const apiKey = await this.getApiKey(config.id);
    const apiBase = normalizeApiBase(config.baseUrl);

    const response = await this.requestFetch(`${apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: payload.messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        stream: payload.stream ?? false,
        tools: payload.tools,
        tool_choice: payload.toolChoice,
      }),
    });

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    return response.json() as Promise<OpenAIChatCompletionResponse>;
  }

  async createResponse(
    config: ModelConfig,
    payload: {
      input: string | Array<{
        type: 'function_call_output';
        call_id: string;
        output: string;
      }>;
      tools?: OpenAITool[];
      toolChoice?: OpenAIToolChoice;
      previousResponseId?: string;
    },
  ): Promise<OpenAIResponsesResponse> {
    const apiKey = await this.getApiKey(config.id);
    const apiBase = normalizeApiBase(config.baseUrl);

    const response = await this.requestFetch(`${apiBase}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        input: payload.input,
        tools: payload.tools,
        tool_choice: payload.toolChoice,
        previous_response_id: payload.previousResponseId,
      }),
    });

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    return response.json() as Promise<OpenAIResponsesResponse>;
  }

  async createToolCallingTurn(
    config: ModelConfig,
    messages: OpenAIMessage[],
    tools: OpenAITool[],
    callFunction: (name: string, args: unknown) => Promise<string>,
    onProgress?: (event: ToolCallingProgressEvent) => void,
  ): Promise<{ finalMessage: string; toolCalls: OpenAIToolCall[] }> {
    if (config.apiProtocol === 'responses') {
      return this.createToolCallingTurnWithResponses(config, messages, tools, callFunction, onProgress);
    }

    let turnMessages = [...messages];
    const allToolCalls: OpenAIToolCall[] = [];
    let finalMessage = '';

    for (let turn = 0; turn < OpenAICompatibleClient.MAX_TOOL_TURNS; turn += 1) {
      onProgress?.({
        type: 'status',
        message: `Thinking (turn ${turn + 1})...`,
      });

      const response = await this.createChatCompletion(config, {
        messages: turnMessages,
        tools,
        toolChoice: 'auto',
        stream: false,
      });

      const assistantMessage = response.choices?.[0]?.message;
      const toolCalls = assistantMessage?.tool_calls ?? [];
      finalMessage = assistantMessage?.content ?? finalMessage;

      if (typeof assistantMessage?.reasoning === 'string' && assistantMessage.reasoning.trim()) {
        onProgress?.({
          type: 'reasoning',
          content: assistantMessage.reasoning,
        });
      }

      if (typeof assistantMessage?.content === 'string' && assistantMessage.content.trim()) {
        onProgress?.({
          type: 'assistant',
          content: assistantMessage.content,
          partial: false,
        });
      }

      if (!toolCalls.length) {
        onProgress?.({
          type: 'done',
          finalMessage,
        });
        return {
          finalMessage,
          toolCalls: allToolCalls,
        };
      }

      allToolCalls.push(...toolCalls);
      turnMessages.push({
        role: 'assistant',
        content: assistantMessage?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        onProgress?.({
          type: 'tool-call',
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        });
        const args = this.parseToolArguments(toolCall.function.arguments);
        const output = await callFunction(toolCall.function.name, args);
        onProgress?.({
          type: 'tool-result',
          id: toolCall.id,
          name: toolCall.function.name,
          output,
        });
        turnMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: output,
        });
      }
    }

    onProgress?.({
      type: 'status',
      message: `Stopped after ${OpenAICompatibleClient.MAX_TOOL_TURNS} tool turns (safety limit).`,
    });
    onProgress?.({
      type: 'done',
      finalMessage,
    });

    return {
      finalMessage,
      toolCalls: allToolCalls,
    };
  }

  private async createToolCallingTurnWithResponses(
    config: ModelConfig,
    messages: OpenAIMessage[],
    tools: OpenAITool[],
    callFunction: (name: string, args: unknown) => Promise<string>,
    onProgress?: (event: ToolCallingProgressEvent) => void,
  ): Promise<{ finalMessage: string; toolCalls: OpenAIToolCall[] }> {
    const inputText = this.serializeMessagesForResponses(messages);
    const allToolCalls: OpenAIToolCall[] = [];
    let response = await this.createResponse(config, {
      input: inputText,
      tools,
      toolChoice: 'auto',
    });
    let finalMessage = this.extractResponseText(response);
    if (finalMessage) {
      onProgress?.({
        type: 'assistant',
        content: finalMessage,
        partial: false,
      });
    }

    for (let turn = 0; turn < OpenAICompatibleClient.MAX_TOOL_TURNS; turn += 1) {
      onProgress?.({
        type: 'status',
        message: `Thinking (turn ${turn + 1})...`,
      });

      const functionCalls = this.extractResponseFunctionCalls(response);
      if (!functionCalls.length) {
        onProgress?.({
          type: 'done',
          finalMessage,
        });
        return {
          finalMessage,
          toolCalls: allToolCalls,
        };
      }

      const outputs: Array<{
        type: 'function_call_output';
        call_id: string;
        output: string;
      }> = [];

      for (const call of functionCalls) {
        onProgress?.({
          type: 'tool-call',
          id: call.call_id,
          name: call.name,
          arguments: call.arguments,
        });
        const args = this.parseToolArguments(call.arguments);
        const output = await callFunction(call.name, args);
        onProgress?.({
          type: 'tool-result',
          id: call.call_id,
          name: call.name,
          output,
        });
        outputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output,
        });
        allToolCalls.push({
          id: call.call_id,
          type: 'function',
          function: {
            name: call.name,
            arguments: call.arguments,
          },
        });
      }

      response = await this.createResponse(config, {
        input: outputs,
        previousResponseId: response.id,
      });

      const text = this.extractResponseText(response);
      if (text) {
        finalMessage = text;
        onProgress?.({
          type: 'assistant',
          content: finalMessage,
          partial: false,
        });
      }
    }

    onProgress?.({
      type: 'status',
      message: `Stopped after ${OpenAICompatibleClient.MAX_TOOL_TURNS} tool turns (safety limit).`,
    });
    onProgress?.({
      type: 'done',
      finalMessage,
    });

    return {
      finalMessage,
      toolCalls: allToolCalls,
    };
  }

  private serializeMessagesForResponses(messages: OpenAIMessage[]): string {
    return messages
      .filter((msg) => msg.role === 'system' || msg.role === 'user')
      .map((msg) => `${msg.role}: ${msg.content ?? ''}`.trim())
      .join('\n\n');
  }

  private extractResponseFunctionCalls(response: OpenAIResponsesResponse): OpenAIResponsesFunctionCall[] {
    return (response.output ?? []).filter((item): item is OpenAIResponsesFunctionCall => item.type === 'function_call');
  }

  private extractResponseText(response: OpenAIResponsesResponse): string {
    const chunks: string[] = [];
    for (const item of response.output ?? []) {
      if (item.type !== 'message' || !('content' in item) || !Array.isArray(item.content)) {
        continue;
      }
      for (const content of item.content) {
        if (content.type === 'output_text' && typeof content.text === 'string') {
          chunks.push(content.text);
        }
      }
    }
    return chunks.join('\n').trim();
  }

  private parseToolArguments(payload: string): unknown {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }

  async *streamChat(config: ModelConfig, messages: OpenAIMessage[]): AsyncGenerator<StreamChunk> {
    const apiKey = await this.getApiKey(config.id);
    const apiBase = normalizeApiBase(config.baseUrl);
    const response = await this.requestFetch(`${apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const lines = rawEvent
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith('data:')) {
            continue;
          }
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            return;
          }
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: 'content', content };
            }
          } catch {
            // ignore invalid event payloads
          }
        }
      }
    }
  }
}

function normalizeApiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('/v1')
    ? withoutTrailingSlash.slice(0, -3)
    : withoutTrailingSlash;
}
