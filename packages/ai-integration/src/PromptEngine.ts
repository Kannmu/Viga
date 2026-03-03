import type { ChatMessage, OpenAIMessage } from './types';

export class PromptEngine {
  buildSystemPrompt(locale: 'zh' | 'en'): string {
    const title = locale === 'zh' ? '你是 Viga AI 设计助手。' : 'You are Viga AI, an expert vector design assistant.';
    return `${title}\n\nYou can use tools to read canvas context and apply edits.\nAlways call read tools before writing when context is unclear.\nWhen applying edits, call apply_canvas_commands with a valid Viga DSL 1.0 payload (version must be \"1.0\").\nUse supported element types: rectangle, ellipse, line, text.\nUse operation.action (not operation.type), and include element.id for create operations.\nAfter tool calls, provide a short plain-language summary.`;
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
