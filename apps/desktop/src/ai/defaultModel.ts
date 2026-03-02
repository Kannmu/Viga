import type { ModelConfig } from '@viga/ai-integration';

export const DEFAULT_MODEL: ModelConfig = {
  id: 'default',
  name: 'Default',
  baseUrl: 'https://api.openai.com',
  modelName: 'gpt-4.1-mini',
  apiKeyRef: 'default',
  maxTokens: 1200,
  temperature: 0.3,
  topP: 1,
};
