import type { ModelConfig } from './types';

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

  constructor(private readonly keyStore: KeyStore) {
    this.load();
  }

  list(): ModelConfig[] {
    return [...this.configs.values()];
  }

  getActive(): ModelConfig | null {
    return this.activeConfigId ? this.configs.get(this.activeConfigId) ?? null : null;
  }

  async saveConfig(config: ModelConfig, apiKey: string): Promise<void> {
    await this.keyStore.store(config.id, apiKey);
    this.configs.set(config.id, config);
    this.activeConfigId = config.id;
    this.persist();
  }

  async deleteConfig(id: string): Promise<void> {
    this.configs.delete(id);
    await this.keyStore.remove(id);
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

  private load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ModelConfig[];
      for (const config of parsed) {
        this.configs.set(config.id, config);
      }
    }
    this.activeConfigId = localStorage.getItem(ACTIVE_KEY);
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
