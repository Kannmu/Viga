import type { EditableNodePatch, NodeId, SceneNode } from './types';
import type { DocumentStore } from './document';

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
