import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export class BrowserKeyStore {
  private readonly prefix = 'viga:key:';

  async store(profileId: string, key: string): Promise<void> {
    localStorage.setItem(`${this.prefix}${profileId}`, key);
  }

  async retrieve(profileId: string): Promise<string> {
    const value = localStorage.getItem(`${this.prefix}${profileId}`);
    if (!value) {
      throw new Error('Missing API key for profile');
    }
    return value;
  }

  async remove(profileId: string): Promise<void> {
    localStorage.removeItem(`${this.prefix}${profileId}`);
  }
}

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const marker = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(marker.__TAURI__ || marker.__TAURI_INTERNALS__);
}

export const runtimeFetch: typeof fetch = (input, init) => {
  if (!isTauriRuntime()) {
    return fetch(input, init);
  }
  return tauriFetch(input as RequestInfo | URL, init as RequestInit) as Promise<Response>;
};
