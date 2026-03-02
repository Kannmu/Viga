import type { SceneNode } from '@viga/editor-core';

export interface ContextBuilderStore {
  getRenderableNodes(): SceneNode[];
  getNode(id: string): SceneNode | null;
}

export class ContextBuilder {
  constructor(private readonly store: ContextBuilderStore) {}

  buildSelectionContext(selectedIds: string[]): string {
    const selectedElements = selectedIds
      .map((id) => this.store.getNode(id))
      .filter((node): node is SceneNode => Boolean(node))
      .map((node) => this.simplifyNode(node));

    return JSON.stringify(
      {
        selectedElements,
        canvasOverviewCount: this.store.getRenderableNodes().length,
      },
      null,
      2,
    );
  }

  buildGlobalContext(): string {
    const overview = this.store.getRenderableNodes().map((node) => this.simplifyNode(node));
    return JSON.stringify({ canvasOverview: overview }, null, 2);
  }

  private simplifyNode(node: SceneNode): object {
    const base = {
      id: node.id,
      type: node.type,
      name: node.name,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };

    if (node.type === 'text') {
      return { ...base, text: node.characters, fontSize: node.fontSize };
    }
    return base;
  }
}
