export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: PluginPermission[];
  ui?: {
    panel?: string;
    width?: number;
    height?: number;
  };
}

export type PluginPermission =
  | 'document:read'
  | 'document:write'
  | 'selection:read'
  | 'network:fetch'
  | 'storage:local'
  | 'ui:notify'
  | 'ui:panel';

export interface SerializedNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PluginEvent =
  | 'selection:change'
  | 'document:change'
  | 'tool:change'
  | 'viewport:change';

export interface VigaPluginAPI {
  document: {
    getSelectedNodes(): Promise<SerializedNode[]>;
    getAllNodes(): Promise<SerializedNode[]>;
    getNodeById(id: string): Promise<SerializedNode | null>;
    createNode(type: string, properties: Record<string, unknown>): Promise<string>;
    modifyNode(id: string, properties: Record<string, unknown>): Promise<void>;
    deleteNode(id: string): Promise<void>;
    group(ids: string[]): Promise<string>;
  };
  viewport: {
    getZoom(): Promise<number>;
    scrollTo(x: number, y: number): Promise<void>;
    zoomTo(zoom: number): Promise<void>;
  };
  ui: {
    showNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
    showPanel(htmlContent: string): void;
    closePanel(): void;
  };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  on(event: PluginEvent, handler: () => void): void;
  off(event: PluginEvent, handler: () => void): void;
}
