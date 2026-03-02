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

export interface ConnectionTestResult {
  success: boolean;
  latency: number;
  status?: number;
  models?: string[];
  error?: string;
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
    }
  | {
      action: 'group';
      elementIds: string[];
      name: string;
    }
  | {
      action: 'align';
      elementIds: string[];
      alignment:
        | 'left'
        | 'center'
        | 'right'
        | 'top'
        | 'middle'
        | 'bottom'
        | 'distribute-h'
        | 'distribute-v';
    }
  | {
      action: 'style';
      targetId: string;
      properties: Record<string, unknown>;
    };

export interface DSLElement {
  id: string;
  type: 'rectangle' | 'ellipse' | 'line' | 'text' | 'frame' | 'polygon' | 'star' | 'path' | 'group';
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fill?: string;
  pathData?: string;
}
