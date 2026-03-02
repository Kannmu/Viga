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
//# sourceMappingURL=browserKeyStore.js.map