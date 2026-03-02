export declare class BrowserKeyStore {
    private readonly prefix;
    store(profileId: string, key: string): Promise<void>;
    retrieve(profileId: string): Promise<string>;
    remove(profileId: string): Promise<void>;
}
