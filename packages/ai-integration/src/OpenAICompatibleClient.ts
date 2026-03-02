import type { ModelConfig, OpenAIMessage, StreamChunk } from './types';

export class APIError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export class OpenAICompatibleClient {
  constructor(private readonly getApiKey: (profileId: string) => Promise<string>) {}

  async *streamChat(config: ModelConfig, messages: OpenAIMessage[]): AsyncGenerator<StreamChunk> {
    const apiKey = await this.getApiKey(config.id);
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
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
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue;
        }
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield { type: 'content', content };
          }
        } catch {
          // ignore invalid partial lines
        }
      }
    }
  }
}
