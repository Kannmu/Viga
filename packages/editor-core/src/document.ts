import { nanoid } from 'nanoid';
import type { Color, DocumentData, NodeId, RectangleNode, SceneNode, TextNode } from './types';

const defaultShapeFill: Color = { r: 0.36, g: 0.6, b: 0.96, a: 1 };

export function createEmptyDocument(name = 'Untitled'): DocumentData {
  return {
    id: nanoid(),
    name,
    version: 1,
    nodeOrder: [],
    nodes: {},
  };
}

export function createRectangleNode(x: number, y: number, width: number, height: number): RectangleNode {
  return {
    id: nanoid(),
    type: 'rectangle',
    name: 'Rectangle',
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [{ type: 'solid', color: defaultShapeFill }],
    cornerRadii: [0, 0, 0, 0],
  };
}

export function createEllipseNode(x: number, y: number, width: number, height: number): SceneNode {
  return {
    id: nanoid(),
    type: 'ellipse',
    name: 'Ellipse',
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [{ type: 'solid', color: defaultShapeFill }],
  };
}

export function createLineNode(x: number, y: number, width: number, height: number): SceneNode {
  return {
    id: nanoid(),
    type: 'line',
    name: 'Line',
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [{ type: 'solid', color: { r: 0.22, g: 0.51, b: 0.96, a: 1 } }],
  };
}

export function createTextNode(x: number, y: number, text: string): TextNode {
  return {
    id: nanoid(),
    type: 'text',
    name: 'Text',
    x,
    y,
    width: Math.max(40, text.length * 9),
    height: 24,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [{ type: 'solid', color: { r: 0.11, g: 0.16, b: 0.26, a: 1 } }],
    characters: text,
    fontSize: 18,
  };
}

export class DocumentStore {
  private document: DocumentData;

  constructor(document: DocumentData) {
    this.document = structuredClone(document);
  }

  snapshot(): DocumentData {
    return structuredClone(this.document);
  }

  load(document: DocumentData): void {
    this.document = structuredClone(document);
  }

  createNode(node: SceneNode): void {
    this.document.nodes[node.id] = node;
    this.document.nodeOrder.push(node.id);
  }

  deleteNodes(ids: NodeId[]): SceneNode[] {
    const removed: SceneNode[] = [];
    for (const id of ids) {
      const node = this.document.nodes[id];
      if (node) {
        removed.push(node);
        delete this.document.nodes[id];
      }
    }
    this.document.nodeOrder = this.document.nodeOrder.filter((id) => !ids.includes(id));
    return removed;
  }

  restoreNodes(nodes: SceneNode[]): void {
    for (const node of nodes) {
      this.document.nodes[node.id] = node;
      if (!this.document.nodeOrder.includes(node.id)) {
        this.document.nodeOrder.push(node.id);
      }
    }
  }

  updateNode(id: NodeId, patch: Partial<SceneNode>): SceneNode | null {
    const node = this.document.nodes[id];
    if (!node) {
      return null;
    }
    const before = structuredClone(node);
    this.document.nodes[id] = { ...node, ...patch } as SceneNode;
    return before;
  }

  moveNodes(ids: NodeId[], dx: number, dy: number): void {
    for (const id of ids) {
      const node = this.document.nodes[id];
      if (!node || node.locked) {
        continue;
      }
      node.x += dx;
      node.y += dy;
    }
  }

  getNode(id: NodeId): SceneNode | null {
    return this.document.nodes[id] ?? null;
  }

  hitTest(x: number, y: number): NodeId | null {
    for (let i = this.document.nodeOrder.length - 1; i >= 0; i -= 1) {
      const id = this.document.nodeOrder[i];
      const node = this.document.nodes[id];
      if (!node || !node.visible) {
        continue;
      }
      if (x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) {
        return id;
      }
    }
    return null;
  }

  getRenderableNodes(): SceneNode[] {
    return this.document.nodeOrder
      .map((id) => this.document.nodes[id])
      .filter((node): node is SceneNode => Boolean(node));
  }
}
