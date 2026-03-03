import type { ConnectionTestResult, ModelConfig } from './types';

export interface KeyStore {
  store(profileId: string, key: string): Promise<void>;
  retrieve(profileId: string): Promise<string>;
  remove(profileId: string): Promise<void>;
}

const STORAGE_KEY = 'viga:model-configs';
const ACTIVE_KEY = 'viga:model-active';

export class ModelConfigManager {
  private configs = new Map<string, ModelConfig>();
  private activeConfigId: string | null = null;

  constructor(
    private readonly keyStore: KeyStore,
    private readonly requestFetch: typeof fetch = fetch,
  ) {
    this.load();
  }

  list(): ModelConfig[] {
    return [...this.configs.values()];
  }

  getActive(): ModelConfig | null {
    return this.activeConfigId ? this.configs.get(this.activeConfigId) ?? null : null;
  }

  async saveConfig(config: ModelConfig, apiKey: string): Promise<void> {
    const normalizedKey = normalizeApiKey(apiKey);
    await this.keyStore.store(this.getApiProfileId(config), normalizedKey);
    this.configs.set(config.id, config);
    this.activeConfigId = config.id;
    this.persist();
  }

  async deleteConfig(id: string): Promise<void> {
    const existing = this.configs.get(id);
    this.configs.delete(id);
    if (existing) {
      await this.keyStore.remove(this.getApiProfileId(existing));
    }
    if (this.activeConfigId === id) {
      this.activeConfigId = null;
    }
    this.persist();
  }

  setActive(id: string): void {
    if (this.configs.has(id)) {
      this.activeConfigId = id;
      this.persist();
    }
  }

  async getApiKeyForProfile(profileId: string): Promise<string> {
    const config = this.configs.get(profileId);
    if (config) {
      const stored = await this.keyStore.retrieve(this.getApiProfileId(config));
      return normalizeApiKey(stored);
    }
    const stored = await this.keyStore.retrieve(profileId);
    return normalizeApiKey(stored);
  }

  async testConnection(id: string): Promise<ConnectionTestResult> {
    const config = this.configs.get(id);
    if (!config) {
      return { success: false, latency: 0, error: 'Model config not found' };
    }

    const startedAt = performance.now();
    try {
      const storedKey = await this.keyStore.retrieve(this.getApiProfileId(config));
      const apiKey = normalizeApiKey(storedKey);
      const apiBase = normalizeApiBase(config.baseUrl);
      const response = await this.requestFetch(`${apiBase}/v1/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const latency = Math.max(0, Math.round(performance.now() - startedAt));
      if (!response.ok) {
        return {
          success: false,
          latency,
          status: response.status,
          error: await response.text(),
        };
      }

      const payload = (await response.json()) as { data?: Array<{ id?: string }> };
      return {
        success: true,
        latency,
        status: response.status,
        models: (payload.data ?? []).map((entry) => entry.id).filter((id): id is string => Boolean(id)),
      };
    } catch (error) {
      return {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Array<Partial<ModelConfig> & { id: string; name: string; baseUrl: string; modelName: string }>;
      for (const config of parsed) {
        this.configs.set(config.id, this.normalizeConfig(config));
      }
    }
    this.activeConfigId = localStorage.getItem(ACTIVE_KEY);
  }

  private normalizeConfig(config: Partial<ModelConfig> & { id: string; name: string; baseUrl: string; modelName: string }): ModelConfig {
    return {
      id: config.id,
      name: config.name,
      provider: config.provider ?? 'openai-compatible',
      apiProtocol: config.apiProtocol ?? 'chat-completions',
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      apiKeyRef: config.apiKeyRef ?? config.id,
      maxTokens: config.maxTokens ?? 1200,
      temperature: config.temperature ?? 0.3,
      topP: config.topP ?? 1,
      systemPromptOverride: config.systemPromptOverride,
    };
  }

  private getApiProfileId(config: ModelConfig): string {
    return config.apiKeyRef || config.id;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list()));
    if (this.activeConfigId) {
      localStorage.setItem(ACTIVE_KEY, this.activeConfigId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
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

function normalizeApiKey(raw: string): string {
  const withoutZeroWidth = raw.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const withoutNewlines = withoutZeroWidth.replace(/[\r\n]+/g, '');
  const withoutBearer = withoutNewlines.replace(/^\s*Bearer\s+/i, '');
  const normalized = withoutBearer.normalize('NFKC').trim();

  if (!normalized) {
    throw new Error('API key is empty after normalization. Please paste the raw key from ZenMux dashboard.');
  }

  const hasNonLatin1 = /[^\u0000-\u00FF]/.test(normalized);
  if (hasNonLatin1) {
    throw new Error('API key contains unsupported characters. Re-copy the key as plain text and avoid smart quotes or full-width characters.');
  }

  return normalized;
}
