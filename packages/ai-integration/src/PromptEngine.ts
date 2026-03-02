import type { ChatMessage, OpenAIMessage } from './types';

export class PromptEngine {
  buildSystemPrompt(locale: 'zh' | 'en'): string {
    const title = locale === 'zh' ? '你是 Viga AI 设计助手。' : 'You are Viga AI, an expert vector design assistant.';
    return `${title}\n\nAlways output valid JSON in a \`\`\`json code block using Viga DSL v1.0.`;
  }

  buildMessages(userMessage: string, context: string, history: ChatMessage[]): OpenAIMessage[] {
    return [
      {
        role: 'system',
        content: `${this.buildSystemPrompt('en')}\n\nContext:\n${context}`,
      },
      ...history,
      {
        role: 'user',
        content: userMessage,
      },
    ];
  }
}
