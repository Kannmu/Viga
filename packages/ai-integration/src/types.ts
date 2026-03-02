export interface ModelConfig {
  id: string;
  name: string;
  baseUrl: string;
  modelName: string;
  apiKeyRef: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  systemPromptOverride?: string;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'content';
  content: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VigaDSL {
  version: '1.0';
  operations: DSLOperation[];
}

export type DSLOperation =
  | {
      action: 'create';
      element: DSLElement;
      parentId?: string;
      insertIndex?: number;
    }
  | {
      action: 'modify';
      targetId: string;
      properties: Record<string, unknown>;
    }
  | {
      action: 'delete';
      targetId: string;
    };

export interface DSLElement {
  id: string;
  type: 'rectangle' | 'ellipse' | 'line' | 'text';
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fill?: string;
}
