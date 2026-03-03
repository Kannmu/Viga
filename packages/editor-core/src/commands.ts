import type { EditableNodePatch, NodeId, SceneNode } from './types';
import type { DocumentStore } from './document';

type AlignMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v';

export interface Command {
  readonly label: string;
  execute(store: DocumentStore): void;
  undo(store: DocumentStore): void;
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(store: DocumentStore, command: Command): void {
    command.execute(store);
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo(store: DocumentStore): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }
    command.undo(store);
    this.redoStack.push(command);
    return true;
  }

  redo(store: DocumentStore): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }
    command.execute(store);
    this.undoStack.push(command);
    return true;
  }
}

export class BatchCommand implements Command {
  readonly label: string;

  constructor(private readonly commands: Command[], label = 'Batch Command') {
    this.label = label;
  }

  execute(store: DocumentStore): void {
    for (const command of this.commands) {
      command.execute(store);
    }
  }

  undo(store: DocumentStore): void {
    for (let i = this.commands.length - 1; i >= 0; i -= 1) {
      this.commands[i].undo(store);
    }
  }
}

export class CreateNodeCommand implements Command {
  readonly label = 'Create Node';
  constructor(private readonly node: SceneNode) {}

  execute(store: DocumentStore): void {
    store.createNode(this.node);
  }

  undo(store: DocumentStore): void {
    store.deleteNodes([this.node.id]);
  }
}

export class DeleteNodesCommand implements Command {
  readonly label = 'Delete Nodes';
  private deleted: SceneNode[] = [];
  constructor(private readonly ids: NodeId[]) {}

  execute(store: DocumentStore): void {
    this.deleted = store.deleteNodes(this.ids);
  }

  undo(store: DocumentStore): void {
    store.restoreNodes(this.deleted);
  }
}

export class MoveNodesCommand implements Command {
  readonly label = 'Move Nodes';

  constructor(
    private readonly ids: NodeId[],
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  execute(store: DocumentStore): void {
    store.moveNodes(this.ids, this.dx, this.dy);
  }

  undo(store: DocumentStore): void {
    store.moveNodes(this.ids, -this.dx, -this.dy);
  }
}

export class UpdateNodesCommand implements Command {
  readonly label = 'Update Nodes';
  private before = new Map<NodeId, SceneNode>();

  constructor(private readonly ids: NodeId[], private readonly patch: EditableNodePatch) {}

  execute(store: DocumentStore): void {
    this.before.clear();
    for (const id of this.ids) {
      const prev = store.updateNode(id, this.patch as Partial<SceneNode>);
      if (prev) {
        this.before.set(id, prev);
      }
    }
  }

  undo(store: DocumentStore): void {
    for (const [id, prev] of this.before) {
      store.updateNode(id, prev);
    }
  }
}

interface NodeBounds {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

function getNodeBounds(node: SceneNode): NodeBounds {
  const minX = Math.min(node.x, node.x + node.width);
  const maxX = Math.max(node.x, node.x + node.width);
  const minY = Math.min(node.y, node.y + node.height);
  const maxY = Math.max(node.y, node.y + node.height);
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function applyNodeOffset(store: DocumentStore, bounds: NodeBounds, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) {
    return;
  }
  store.updateNode(bounds.id, {
    x: bounds.x + dx,
    y: bounds.y + dy,
  });
}

export class AlignNodesCommand implements Command {
  readonly label = 'Align Nodes';
  private before = new Map<NodeId, SceneNode>();

  constructor(private readonly ids: NodeId[], private readonly alignment: AlignMode) {}

  execute(store: DocumentStore): void {
    this.before.clear();

    const bounds = this.ids
      .map((id) => store.getNode(id))
      .filter((node): node is SceneNode => Boolean(node))
      .map((node) => {
        this.before.set(node.id, structuredClone(node));
        return getNodeBounds(node);
      });

    if (bounds.length === 0) {
      return;
    }

    const minX = Math.min(...bounds.map((item) => item.minX));
    const maxX = Math.max(...bounds.map((item) => item.maxX));
    const minY = Math.min(...bounds.map((item) => item.minY));
    const maxY = Math.max(...bounds.map((item) => item.maxY));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (this.alignment === 'left') {
      for (const item of bounds) {
        applyNodeOffset(store, item, minX - item.minX, 0);
      }
      return;
    }

    if (this.alignment === 'center') {
      for (const item of bounds) {
        applyNodeOffset(store, item, centerX - item.centerX, 0);
      }
      return;
    }

    if (this.alignment === 'right') {
      for (const item of bounds) {
        applyNodeOffset(store, item, maxX - item.maxX, 0);
      }
      return;
    }

    if (this.alignment === 'top') {
      for (const item of bounds) {
        applyNodeOffset(store, item, 0, minY - item.minY);
      }
      return;
    }

    if (this.alignment === 'middle') {
      for (const item of bounds) {
        applyNodeOffset(store, item, 0, centerY - item.centerY);
      }
      return;
    }

    if (this.alignment === 'bottom') {
      for (const item of bounds) {
        applyNodeOffset(store, item, 0, maxY - item.maxY);
      }
      return;
    }

    if (this.alignment === 'distribute-h') {
      if (bounds.length < 3) {
        return;
      }
      const sorted = [...bounds].sort((a, b) => a.minX - b.minX);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const inner = sorted.slice(1, -1);
      const innerWidth = inner.reduce((sum, item) => sum + (item.maxX - item.minX), 0);
      const span = last.minX - first.maxX;
      const gap = (span - innerWidth) / (sorted.length - 1);

      let cursor = first.maxX + gap;
      for (const item of inner) {
        applyNodeOffset(store, item, cursor - item.minX, 0);
        cursor += (item.maxX - item.minX) + gap;
      }
      return;
    }

    if (this.alignment === 'distribute-v') {
      if (bounds.length < 3) {
        return;
      }
      const sorted = [...bounds].sort((a, b) => a.minY - b.minY);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const inner = sorted.slice(1, -1);
      const innerHeight = inner.reduce((sum, item) => sum + (item.maxY - item.minY), 0);
      const span = last.minY - first.maxY;
      const gap = (span - innerHeight) / (sorted.length - 1);

      let cursor = first.maxY + gap;
      for (const item of inner) {
        applyNodeOffset(store, item, 0, cursor - item.minY);
        cursor += (item.maxY - item.minY) + gap;
      }
    }
  }

  undo(store: DocumentStore): void {
    for (const [id, prev] of this.before) {
      store.updateNode(id, prev);
    }
  }
}
