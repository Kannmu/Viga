import { create } from 'zustand';
import { createEmptyDocument, createRectangleNode, DocumentStore } from './document';
import { CommandManager, CreateNodeCommand, DeleteNodesCommand } from './commands';
import type { DocumentData, NodeId, ToolType } from './types';
import { ToolType as ToolTypes } from './types';

interface EditorState {
  documentStore: DocumentStore;
  commandManager: CommandManager;
  activeTool: ToolType;
  selectedIds: NodeId[];
  loadDocument: (document: DocumentData) => void;
  setTool: (tool: ToolType) => void;
  createRectangle: (x: number, y: number, width: number, height: number) => void;
  selectAt: (x: number, y: number, append: boolean) => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  documentStore: new DocumentStore(createEmptyDocument()),
  commandManager: new CommandManager(),
  activeTool: ToolTypes.Select,
  selectedIds: [],

  loadDocument: (document) => {
    const store = get().documentStore;
    store.load(document);
    set({ selectedIds: [] });
  },

  setTool: (tool) => set({ activeTool: tool }),

  createRectangle: (x, y, width, height) => {
    const state = get();
    const node = createRectangleNode(x, y, width, height);
    state.commandManager.execute(state.documentStore, new CreateNodeCommand(node));
    set({ selectedIds: [node.id] });
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

  deleteSelection: () => {
    const state = get();
    if (state.selectedIds.length === 0) {
      return;
    }
    state.commandManager.execute(state.documentStore, new DeleteNodesCommand(state.selectedIds));
    set({ selectedIds: [] });
  },

  undo: () => {
    const state = get();
    state.commandManager.undo(state.documentStore);
    set({ selectedIds: [] });
  },

  redo: () => {
    const state = get();
    state.commandManager.redo(state.documentStore);
    set({ selectedIds: [] });
  },
}));
