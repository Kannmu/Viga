import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
export class BrowserKeyStore {
    prefix = 'viga:key:';
    async store(profileId, key) {
        localStorage.setItem(`${this.prefix}${profileId}`, key);
    }
    async retrieve(profileId) {
        const value = localStorage.getItem(`${this.prefix}${profileId}`);
        if (!value) {
            throw new Error('Missing API key for profile');
        }
        return value;
    }
    async remove(profileId) {
        localStorage.removeItem(`${this.prefix}${profileId}`);
    }
}
function isTauriRuntime() {
    if (typeof window === 'undefined') {
        return false;
    }
    const marker = window;
    return Boolean(marker.__TAURI__ || marker.__TAURI_INTERNALS__);
}
export const runtimeFetch = (input, init) => {
    if (!isTauriRuntime()) {
        return fetch(input, init);
    }
    return tauriFetch(input, init);
};
//# sourceMappingURL=browserKeyStore.js.map