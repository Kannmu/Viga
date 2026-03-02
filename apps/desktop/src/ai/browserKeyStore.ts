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
