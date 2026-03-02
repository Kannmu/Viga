import type { SceneNode } from '@viga/editor-core';

export interface ContextBuilderStore {
  getRenderableNodes(): SceneNode[];
  getNode(id: string): SceneNode | null;
}

export class ContextBuilder {
  constructor(private readonly store: ContextBuilderStore) {}

  buildSelectionContext(selectedIds: string[], maxOverviewCount = 200): string {
    const selectedElements = selectedIds
      .map((id) => this.store.getNode(id))
      .filter((node): node is SceneNode => Boolean(node))
      .map((node) => this.simplifyNode(node));

    const overviewCount = this.store.getRenderableNodes().length;

    return JSON.stringify(
      {
        selectedElements,
        canvasOverviewCount: overviewCount,
        hasSelection: selectedElements.length > 0,
        contextPolicy: {
          maxOverviewCount,
          selectedOnly: selectedElements.length > 0,
        },
      },
      null,
      2,
    );
  }

  buildGlobalContext(maxNodes = 200): string {
    const nodes = this.store.getRenderableNodes();
    const sampled = nodes.slice(0, Math.max(0, maxNodes));
    const overview = sampled.map((node) => this.simplifyNode(node));
    return JSON.stringify(
      {
        canvasOverview: overview,
        totalNodeCount: nodes.length,
        truncated: nodes.length > sampled.length,
      },
      null,
      2,
    );
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
