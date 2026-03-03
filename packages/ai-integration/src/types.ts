export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai-compatible';
  apiProtocol?: 'chat-completions' | 'responses';
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
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface StreamChunk {
  type: 'content';
  content: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
    strict?: boolean;
  };
}

export type OpenAIToolChoice
  = 'auto'
  | 'required'
  | 'none'
  | {
      type: 'function';
      function: {
        name: string;
      };
    }
  | {
      type: 'allowed_tools';
      mode: 'auto' | 'required';
      tools: Array<{
        type: 'function';
        function: {
          name: string;
        };
      }>;
    };

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      role?: 'assistant';
      content?: string | null;
      reasoning?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
}

export interface OpenAIResponsesFunctionCall {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
}

export interface OpenAIResponsesOutputMessage {
  type: 'message';
  role?: 'assistant';
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

export interface OpenAIResponsesResponse {
  id: string;
  output?: Array<OpenAIResponsesFunctionCall | OpenAIResponsesOutputMessage | { type?: string }>;
}

export type ToolCallingProgressEvent
  = {
      type: 'status';
      message: string;
    }
  | {
      type: 'assistant';
      content: string;
      partial: boolean;
    }
  | {
      type: 'reasoning';
      content: string;
    }
  | {
      type: 'tool-call';
      id: string;
      name: string;
      arguments: string;
    }
  | {
      type: 'tool-result';
      id: string;
      name: string;
      output: string;
    }
  | {
      type: 'done';
      finalMessage: string;
    };

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
  rotation?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fill?: string;
  pathData?: string;
}
