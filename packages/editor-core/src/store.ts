import { create } from 'zustand';
import {
  createEmptyDocument,
  createEllipseNode,
  createLineNode,
  createRectangleNode,
  createTextNode,
  DocumentStore,
} from './document';
import {
  CommandManager,
  type Command,
  CreateNodeCommand,
  DeleteNodesCommand,
  MoveNodesCommand,
  UpdateNodesCommand,
} from './commands';
import type { DocumentData, EditableNodePatch, NodeId, ToolType } from './types';
import { ToolType as ToolTypes } from './types';

interface EditorState {
  documentStore: DocumentStore;
  documentVersion: number;
  commandManager: CommandManager;
  activeTool: ToolType;
  selectedIds: NodeId[];
  dragState: {
    active: boolean;
    lastX: number;
    lastY: number;
    moved: boolean;
    totalDx: number;
    totalDy: number;
    appendSelection: boolean;
  };
  loadDocument: (document: DocumentData) => void;
  setTool: (tool: ToolType) => void;
  createShape: (tool: ToolType, x: number, y: number, width: number, height: number) => void;
  createText: (x: number, y: number, value?: string) => void;
  selectAt: (x: number, y: number, append: boolean) => void;
  setSelectedIds: (ids: NodeId[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  beginPointerDrag: (x: number, y: number, append: boolean) => void;
  updatePointerDrag: (x: number, y: number) => void;
  endPointerDrag: () => void;
  updateSelectionStyles: (patch: EditableNodePatch) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  applyCommands: (commands: Command[]) => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
}

function commitVersion(setter: (updater: (curr: EditorState) => Partial<EditorState>) => void): void {
  setter((curr) => ({ documentVersion: curr.documentVersion + 1 }));
}

function isShapeTool(tool: ToolType): tool is 'rectangle' | 'ellipse' | 'line' {
  return tool === ToolTypes.Rectangle || tool === ToolTypes.Ellipse || tool === ToolTypes.Line;
}

function sanitizePatch(patch: EditableNodePatch): EditableNodePatch {
  const clean: EditableNodePatch = {};
  if (typeof patch.x === 'number') clean.x = patch.x;
  if (typeof patch.y === 'number') clean.y = patch.y;
  if (typeof patch.width === 'number') clean.width = Math.max(1, patch.width);
  if (typeof patch.height === 'number') clean.height = Math.max(1, patch.height);
  if (typeof patch.opacity === 'number') clean.opacity = Math.min(1, Math.max(0, patch.opacity));
  if (typeof patch.name === 'string') clean.name = patch.name;
  if (Array.isArray(patch.fills)) clean.fills = patch.fills;
  return clean;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  documentStore: new DocumentStore(createEmptyDocument()),
  documentVersion: 0,
  commandManager: new CommandManager(),
  activeTool: ToolTypes.Select,
  selectedIds: [],
  dragState: {
    active: false,
    lastX: 0,
    lastY: 0,
    moved: false,
    totalDx: 0,
    totalDy: 0,
    appendSelection: false,
  },

  loadDocument: (document) => {
    const store = get().documentStore;
    store.load(document);
    set((state) => ({ selectedIds: [], documentVersion: state.documentVersion + 1 }));
  },

  setTool: (tool) => set({ activeTool: tool }),

  createShape: (tool, x, y, width, height) => {
    if (!isShapeTool(tool)) {
      return;
    }
    const state = get();
    const node =
      tool === ToolTypes.Ellipse
        ? createEllipseNode(x, y, width, height)
        : tool === ToolTypes.Line
          ? createLineNode(x, y, width, height)
          : createRectangleNode(x, y, width, height);
    state.commandManager.execute(state.documentStore, new CreateNodeCommand(node));
    set((curr) => ({ selectedIds: [node.id], documentVersion: curr.documentVersion + 1 }));
  },

  createText: (x, y, value = 'Text') => {
    const state = get();
    const node = createTextNode(x, y, value);
    state.commandManager.execute(state.documentStore, new CreateNodeCommand(node));
    set((curr) => ({ selectedIds: [node.id], documentVersion: curr.documentVersion + 1 }));
  },

  selectAt: (x, y, append) => {
    const state = get();
    const hit = state.documentStore.hitTest(x, y);
    if (!hit) {
      set({ selectedIds: [] });
      return;
    }
    if (append) {
      const next = state.selectedIds.includes(hit)
        ? state.selectedIds.filter((id) => id !== hit)
        : [...state.selectedIds, hit];
      set({ selectedIds: next });
      return;
    }
    set({ selectedIds: [hit] });
  },

  setSelectedIds: (ids) => set({ selectedIds: [...new Set(ids)] }),

  selectAll: () => {
    const state = get();
    const ids = state.documentStore.getRenderableNodes().map((node) => node.id);
    set({ selectedIds: ids });
  },

  clearSelection: () => set({ selectedIds: [] }),

  beginPointerDrag: (x, y, append) => {
    const state = get();
    const hit = state.documentStore.hitTest(x, y);

    if (!hit) {
      set({
        selectedIds: [],
        dragState: {
          active: false,
          lastX: x,
          lastY: y,
          moved: false,
          totalDx: 0,
          totalDy: 0,
          appendSelection: append,
        },
      });
      return;
    }

    const alreadySelected = state.selectedIds.includes(hit);
    const nextSelection = append
      ? alreadySelected
        ? state.selectedIds.filter((id) => id !== hit)
        : [...state.selectedIds, hit]
      : alreadySelected
        ? state.selectedIds
        : [hit];

    set({
      selectedIds: nextSelection,
      dragState: {
        active: true,
        lastX: x,
        lastY: y,
        moved: false,
        totalDx: 0,
        totalDy: 0,
        appendSelection: append,
      },
    });
  },

  updatePointerDrag: (x, y) => {
    const state = get();
    if (!state.dragState.active || state.selectedIds.length === 0) {
      return;
    }
    const dx = x - state.dragState.lastX;
    const dy = y - state.dragState.lastY;
    if (dx === 0 && dy === 0) {
      return;
    }
    state.documentStore.moveNodes(state.selectedIds, dx, dy);
    set((curr) => ({
      documentVersion: curr.documentVersion + 1,
      dragState: {
        ...curr.dragState,
        lastX: x,
        lastY: y,
        moved: true,
        totalDx: curr.dragState.totalDx + dx,
        totalDy: curr.dragState.totalDy + dy,
      },
    }));
  },

  endPointerDrag: () => {
    const state = get();
    if (!state.dragState.active) {
      return;
    }

    const { totalDx, totalDy, moved } = state.dragState;
    if (moved && (totalDx !== 0 || totalDy !== 0) && state.selectedIds.length > 0) {
      state.documentStore.moveNodes(state.selectedIds, -totalDx, -totalDy);
      state.commandManager.execute(state.documentStore, new MoveNodesCommand(state.selectedIds, totalDx, totalDy));
      commitVersion(set);
    }

    set((curr) => ({
      dragState: {
        ...curr.dragState,
        active: false,
        moved: false,
        totalDx: 0,
        totalDy: 0,
      },
    }));
  },

  updateSelectionStyles: (patch) => {
    const state = get();
    if (state.selectedIds.length === 0) {
      return;
    }

    const safePatch = sanitizePatch(patch);
    const patchKeys = Object.keys(safePatch);
    if (patchKeys.length === 0) {
      return;
    }

    state.commandManager.execute(state.documentStore, new UpdateNodesCommand(state.selectedIds, safePatch));
    commitVersion(set);
  },

  nudgeSelection: (dx, dy) => {
    const state = get();
    if (state.selectedIds.length === 0 || (dx === 0 && dy === 0)) {
      return;
    }
    state.commandManager.execute(state.documentStore, new MoveNodesCommand(state.selectedIds, dx, dy));
    commitVersion(set);
  },

  applyCommands: (commands) => {
    if (commands.length === 0) {
      return;
    }
    const state = get();
    for (const command of commands) {
      state.commandManager.execute(state.documentStore, command);
    }
    commitVersion(set);
  },

  deleteSelection: () => {
    const state = get();
    if (state.selectedIds.length === 0) {
      return;
    }
    state.commandManager.execute(state.documentStore, new DeleteNodesCommand(state.selectedIds));
    set((curr) => ({ selectedIds: [], documentVersion: curr.documentVersion + 1 }));
  },

  undo: () => {
    const state = get();
    state.commandManager.undo(state.documentStore);
    set((curr) => ({
      selectedIds: [],
      dragState: { ...curr.dragState, active: false, moved: false },
      documentVersion: curr.documentVersion + 1,
    }));
  },

  redo: () => {
    const state = get();
    state.commandManager.redo(state.documentStore);
    set((curr) => ({
      selectedIds: [],
      dragState: { ...curr.dragState, active: false, moved: false },
      documentVersion: curr.documentVersion + 1,
    }));
  },
}));
