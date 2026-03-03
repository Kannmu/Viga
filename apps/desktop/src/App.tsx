import { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyDocument, ToolType, useEditorStore } from '@viga/editor-core';
import { WebGL2Renderer } from '@viga/canvas-engine';
import {
  ContextBuilder,
  DSLCompiler,
  ModelConfigManager,
  OpenAICompatibleClient,
  PromptEngine,
  type ChatMessage,
  type DSLElement,
  type DSLOperation,
  type OpenAITool,
  type ToolCallingProgressEvent,
  type VigaDSL,
} from '@viga/ai-integration';
import { ToolBar, PropertiesPanel, LayerPanel } from '@viga/ui-components';
import { AiPanel } from './components/AiPanel';
import { BrowserKeyStore, runtimeFetch } from './ai/browserKeyStore';
import { DEFAULT_MODEL } from './ai/defaultModel';
import {
  createPreviewNode,
  getDraftGeometry,
  hasMeaningfulDraft,
  updateDraftPoint,
  type DrawDraft,
} from './canvas/draft';

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeVigaDSL(raw: unknown): VigaDSL | null {
  type AlignOperation = Extract<DSLOperation, { action: 'align' }>;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as {
    version?: unknown;
    operations?: unknown;
  };
  const version = typeof source.version === 'string' ? source.version.trim() : '';
  if (version !== '1.0' && version.toLowerCase() !== 'v1.0') {
    return null;
  }
  if (!Array.isArray(source.operations)) {
    return null;
  }

  const allowedElementTypes = new Set(['rectangle', 'ellipse', 'line', 'text', 'frame', 'polygon', 'star', 'path', 'group']);
  const allowedAlignments = new Set(['left', 'center', 'right', 'top', 'middle', 'bottom', 'distribute-h', 'distribute-v']);
  const seed = Date.now().toString(36);
  const operations: DSLOperation[] = [];

  source.operations.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const op = item as Record<string, unknown>;
    const action = typeof op.action === 'string'
      ? op.action
      : typeof op.type === 'string'
        ? op.type
        : '';

    if (action === 'create') {
      const elementSource = op.element && typeof op.element === 'object'
        ? (op.element as Record<string, unknown>)
        : null;
      if (!elementSource) {
        return;
      }

      const rawElementType = typeof elementSource.type === 'string' ? elementSource.type : 'rectangle';
      const elementType = allowedElementTypes.has(rawElementType) ? rawElementType : 'rectangle';
      const rx = toFiniteNumber(elementSource.rx, 0);
      const ry = toFiniteNumber(elementSource.ry, 0);
      const width = typeof elementSource.width === 'number' ? elementSource.width : (rx > 0 ? rx * 2 : undefined);
      const height = typeof elementSource.height === 'number' ? elementSource.height : (ry > 0 ? ry * 2 : undefined);
      const normalizedElement: DSLElement = {
        id: typeof elementSource.id === 'string' && elementSource.id.trim()
          ? elementSource.id
          : `ai_${seed}_${index}`,
        type: elementType as DSLElement['type'],
        x: toFiniteNumber(elementSource.x, 0),
        y: toFiniteNumber(elementSource.y, 0),
        ...(typeof width === 'number' ? { width } : {}),
        ...(typeof height === 'number' ? { height } : {}),
        ...(typeof elementSource.rotation === 'number' ? { rotation: elementSource.rotation } : {}),
        ...(typeof elementSource.name === 'string' ? { name: elementSource.name } : {}),
        ...(typeof elementSource.text === 'string' ? { text: elementSource.text } : {}),
        ...(typeof elementSource.fontSize === 'number' ? { fontSize: elementSource.fontSize } : {}),
        ...(typeof elementSource.fill === 'string' ? { fill: elementSource.fill } : {}),
      };

      operations.push({
        action: 'create',
        element: normalizedElement,
      });
      return;
    }

    if (action === 'modify') {
      if (typeof op.targetId !== 'string' || !op.targetId.trim()) {
        return;
      }
      operations.push({
        action: 'modify',
        targetId: op.targetId,
        properties: op.properties && typeof op.properties === 'object'
          ? (op.properties as Record<string, unknown>)
          : {},
      });
      return;
    }

    if (action === 'style') {
      if (typeof op.targetId !== 'string' || !op.targetId.trim()) {
        return;
      }
      operations.push({
        action: 'style',
        targetId: op.targetId,
        properties: op.properties && typeof op.properties === 'object'
          ? (op.properties as Record<string, unknown>)
          : {},
      });
      return;
    }

    if (action === 'delete') {
      if (typeof op.targetId !== 'string' || !op.targetId.trim()) {
        return;
      }
      operations.push({ action: 'delete', targetId: op.targetId });
      return;
    }

    if (action === 'group') {
      const elementIds = Array.isArray(op.elementIds)
        ? op.elementIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [];
      if (elementIds.length < 2) {
        return;
      }
      operations.push({
        action: 'group',
        elementIds,
        name: typeof op.name === 'string' && op.name.trim() ? op.name : 'Group',
      });
      return;
    }

    if (action === 'align') {
      const elementIds = Array.isArray(op.elementIds)
        ? op.elementIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [];
      if (elementIds.length < 2 || typeof op.alignment !== 'string' || !allowedAlignments.has(op.alignment)) {
        return;
      }
      operations.push({
        action: 'align',
        elementIds,
        alignment: op.alignment as AlignOperation['alignment'],
      });
      return;
    }
  });

  return {
    version: '1.0',
    operations,
  };
}

function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGL2Renderer | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [aiPanelWidth, setAiPanelWidth] = useState(360);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [rightStackSplit, setRightStackSplit] = useState(0.44);
  const panStateRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const panelResizeRef = useRef<{ side: 'ai' | 'right'; startX: number; startWidth: number } | null>(null);
  const rightStackRef = useRef<HTMLElement | null>(null);
  const rightStackResizeRef = useRef<{ startY: number; startSplit: number; height: number } | null>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ToolCallingProgressEvent[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState(DEFAULT_MODEL);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [testStatus, setTestStatus] = useState<string>('');
  const [modelRevision, setModelRevision] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeTool = useEditorStore((s) => s.activeTool);
  const dragState = useEditorStore((s) => s.dragState);
  const documentStore = useEditorStore((s) => s.documentStore);
  const documentVersion = useEditorStore((s) => s.documentVersion);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setTool = useEditorStore((s) => s.setTool);
  const createShape = useEditorStore((s) => s.createShape);
  const createText = useEditorStore((s) => s.createText);
  const selectAll = useEditorStore((s) => s.selectAll);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const beginPointerDrag = useEditorStore((s) => s.beginPointerDrag);
  const updatePointerDrag = useEditorStore((s) => s.updatePointerDrag);
  const endPointerDrag = useEditorStore((s) => s.endPointerDrag);
  const updateSelectionStyles = useEditorStore((s) => s.updateSelectionStyles);
  const nudgeSelection = useEditorStore((s) => s.nudgeSelection);
  const applyCommands = useEditorStore((s) => s.applyCommands);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const nodes = useMemo(() => documentStore.getRenderableNodes(), [documentStore, documentVersion]);
  const selectedNode = useMemo(
    () => (selectedIds.length === 1 ? documentStore.getNode(selectedIds[0]) : null),
    [documentStore, documentVersion, selectedIds],
  );
  const previewNodes = useMemo(
    () => (drawDraft && hasMeaningfulDraft(drawDraft) ? [createPreviewNode(drawDraft)] : []),
    [drawDraft],
  );
  const marqueeBox = useMemo(() => {
    if (!dragState.active || dragState.mode !== 'marquee') {
      return null;
    }
    const x1 = dragState.startX * viewport.zoom + viewport.panX;
    const y1 = dragState.startY * viewport.zoom + viewport.panY;
    const x2 = dragState.lastX * viewport.zoom + viewport.panX;
    const y2 = dragState.lastY * viewport.zoom + viewport.panY;
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }, [dragState, viewport.panX, viewport.panY, viewport.zoom]);

  const keyStore = useMemo(() => new BrowserKeyStore(), []);
  const modelManager = useMemo(() => new ModelConfigManager(keyStore, runtimeFetch), [keyStore]);
  const aiClient = useMemo(
    () => new OpenAICompatibleClient((profileId) => modelManager.getApiKeyForProfile(profileId), runtimeFetch),
    [modelManager],
  );
  const contextBuilder = useMemo(() => new ContextBuilder(documentStore), [documentStore]);
  const promptEngine = useMemo(() => new PromptEngine(), []);
  const dslCompiler = useMemo(() => new DSLCompiler(), []);

  const modelConfigs = useMemo(() => modelManager.list(), [modelManager, modelRevision]);
  const aiTools = useMemo<OpenAITool[]>(() => [
    {
      type: 'function',
      function: {
        name: 'read_canvas_context',
        description: 'Read selected nodes or global canvas overview before planning edits.',
        parameters: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: ['selection', 'global'],
              description: 'Read selection or full canvas context.',
            },
          },
          required: ['scope'],
          additionalProperties: false,
        },
        strict: true,
      },
    },
    {
      type: 'function',
      function: {
        name: 'apply_canvas_commands',
        description: 'Apply edits by sending a complete Viga DSL v1.0 payload.',
        parameters: {
          type: 'object',
          properties: {
            dsl: {
              type: 'object',
              description: 'A full Viga DSL object with version and operations.',
            },
          },
          required: ['dsl'],
          additionalProperties: false,
        },
        strict: true,
      },
    },
  ], []);

  useEffect(() => {
    loadDocument(createEmptyDocument());
  }, [loadDocument]);

  useEffect(() => {
    const active = modelManager.getActive() ?? modelManager.list()[0] ?? DEFAULT_MODEL;
    setModelDraft(active);
  }, [modelManager, modelRevision]);

  useEffect(() => {
    if (!canvasRef.current || rendererRef.current) {
      return;
    }
    try {
      const renderer = new WebGL2Renderer(canvasRef.current);
      rendererRef.current = renderer;
      renderer.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
      renderer.setViewport(viewport);
      setRendererError(null);

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !canvasRef.current || !rendererRef.current) {
          return;
        }
        rendererRef.current.resize(entry.contentRect.width, entry.contentRect.height);
        rendererRef.current.render(nodes, selectedIds);
      });
      observer.observe(canvasRef.current);

      return () => {
        observer.disconnect();
        renderer.destroy();
        rendererRef.current = null;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Renderer initialization failed';
      setRendererError(message);
      console.error('Canvas renderer failed to initialize:', error);
      return;
    }
  }, []);

  useEffect(() => {
    if (!rendererRef.current) {
      return;
    }
    rendererRef.current.setViewport(viewport);
    rendererRef.current.render(nodes, selectedIds, { previewNodes });
  }, [nodes, selectedIds, viewport, previewNodes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditableField = Boolean(
        target
          && (target instanceof HTMLInputElement
            || target instanceof HTMLTextAreaElement
            || target instanceof HTMLSelectElement
            || target.isContentEditable),
      );

      if (inEditableField) {
        return;
      }

      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      }
      if (e.key.toLowerCase() === 'v') {
        setTool(ToolType.Select);
      }
      if (e.key.toLowerCase() === 'r') {
        setTool(ToolType.Rectangle);
      }
      if (e.key.toLowerCase() === 'o') {
        setTool(ToolType.Ellipse);
      }
      if (e.key.toLowerCase() === 'l') {
        setTool(ToolType.Line);
      }
      if (e.key.toLowerCase() === 'p') {
        setTool(ToolType.Pen);
      }
      if (e.key.toLowerCase() === 't') {
        setTool(ToolType.Text);
      }
      if (e.key.toLowerCase() === 'h') {
        setTool(ToolType.Hand);
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeSelection(0, e.shiftKey ? -10 : -1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeSelection(0, e.shiftKey ? 10 : 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeSelection(e.shiftKey ? -10 : -1, 0);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeSelection(e.shiftKey ? 10 : 1, 0);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, deleteSelection, nudgeSelection, redo, selectAll, setTool, undo]);

  useEffect(() => {
    const minWidth = 240;
    const maxWidth = 520;

    const onMouseMove = (event: MouseEvent) => {
      const draft = panelResizeRef.current;
      if (draft?.side === 'ai') {
        const next = Math.max(280, Math.min(maxWidth, draft.startWidth + (event.clientX - draft.startX)));
        setAiPanelWidth(next);
      } else if (draft?.side === 'right') {
        const next = Math.max(minWidth, Math.min(maxWidth, draft.startWidth - (event.clientX - draft.startX)));
        setRightPanelWidth(next);
      }

      const rightSplitDraft = rightStackResizeRef.current;
      if (rightSplitDraft) {
        const delta = event.clientY - rightSplitDraft.startY;
        const ratio = rightSplitDraft.startSplit + delta / Math.max(1, rightSplitDraft.height);
        setRightStackSplit(Math.max(0.22, Math.min(0.78, ratio)));
      }
    };

    const onMouseUp = () => {
      panelResizeRef.current = null;
      rightStackResizeRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const toCanvasPoint = (event: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!rendererRef.current) {
      return { x, y };
    }
    return rendererRef.current.screenToCanvas(x, y);
  };

  const beginPan = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    panStateRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };
  };

  const mouseHandlers = useMemo(
    () => ({
      onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 1 || activeTool === ToolType.Hand) {
          e.preventDefault();
          beginPan(e);
          return;
        }

        const point = toCanvasPoint(e);
        if (
          activeTool === ToolType.Rectangle
          || activeTool === ToolType.Ellipse
          || activeTool === ToolType.Line
          || activeTool === ToolType.Pen
        ) {
          setDrawDraft({
            tool: activeTool,
            startX: point.x,
            startY: point.y,
            currentX: point.x,
            currentY: point.y,
          });
          return;
        }
        if (activeTool === ToolType.Text) {
          createText(point.x, point.y);
          setTool(ToolType.Select);
          return;
        }
        beginPointerDrag(point.x, point.y, e.shiftKey);
      },
      onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => {
        const point = toCanvasPoint(e);

        if (panStateRef.current.active) {
          const dx = e.clientX - panStateRef.current.lastX;
          const dy = e.clientY - panStateRef.current.lastY;
          panStateRef.current.lastX = e.clientX;
          panStateRef.current.lastY = e.clientY;
          setViewport((curr) => ({ ...curr, panX: curr.panX + dx, panY: curr.panY + dy }));
          return;
        }

        if (drawDraft) {
          setDrawDraft((curr) => (curr ? updateDraftPoint(curr, point.x, point.y) : curr));
          return;
        }

        updatePointerDrag(point.x, point.y);
      },
      onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => {
        panStateRef.current.active = false;

      if (drawDraft) {
        const point = toCanvasPoint(e);
        const finalDraft = updateDraftPoint(drawDraft, point.x, point.y);
        const shouldCreate = hasMeaningfulDraft(finalDraft);
        setDrawDraft(null);
        if (!shouldCreate) {
          return;
        }

        const geometry = getDraftGeometry(finalDraft);
        if (finalDraft.tool === ToolType.Line || finalDraft.tool === ToolType.Pen) {
          createShape(ToolType.Line, geometry.x, geometry.y, geometry.width, geometry.height);
          setTool(ToolType.Select);
          return;
        }

        createShape(finalDraft.tool, geometry.x, geometry.y, geometry.width, geometry.height);
        setTool(ToolType.Select);
        return;
      }

        endPointerDrag();
      },
      onMouseLeave: () => {
        panStateRef.current.active = false;
        setDrawDraft(null);
        endPointerDrag();
      },
      onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const rect = e.currentTarget.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          setViewport((curr) => {
            const nextZoom = Math.min(8, Math.max(0.2, curr.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
            const scale = nextZoom / curr.zoom;
            return {
              panX: screenX - scale * (screenX - curr.panX),
              panY: screenY - scale * (screenY - curr.panY),
              zoom: nextZoom,
            };
          });
          return;
        }
        setViewport((curr) => ({
          ...curr,
          panX: curr.panX - e.deltaX,
          panY: curr.panY - e.deltaY,
        }));
      },
    }),
    [activeTool, beginPointerDrag, createShape, createText, drawDraft, endPointerDrag, setTool, updatePointerDrag],
  );

  const runAiCommand = async (): Promise<void> => {
    const prompt = chatInput.trim();
    if (!prompt || chatStreaming) {
      return;
    }

    const activeModel = modelManager.getActive() ?? modelDraft;
    if (!activeModel) {
      setChatError('No model configuration available. Save a model profile first.');
      return;
    }

    setChatStreaming(true);
    setChatError(null);
    setProgressEvents([]);
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', content: prompt }]);

    const selectionContext = contextBuilder.buildSelectionContext(selectedIds);
    const historySnapshot = chatHistory;
    const messages = promptEngine.buildMessages(prompt, selectionContext, historySnapshot);

    try {
      const result = await aiClient.createToolCallingTurn(
        activeModel,
        messages,
        aiTools,
        async (name, args) => {
          if (name === 'read_canvas_context') {
            const scope = typeof (args as { scope?: unknown })?.scope === 'string'
              ? (args as { scope: string }).scope
              : 'selection';
            const context = scope === 'global'
              ? contextBuilder.buildGlobalContext()
              : contextBuilder.buildSelectionContext(selectedIds);
            return JSON.stringify({ ok: true, context });
          }

          if (name === 'apply_canvas_commands') {
            const payload = (args as { dsl?: unknown })?.dsl;
            if (!payload || typeof payload !== 'object') {
              return JSON.stringify({ ok: false, error: 'Missing dsl payload' });
            }
            const dsl = normalizeVigaDSL(payload);
            if (!dsl) {
              return JSON.stringify({ ok: false, error: 'Invalid DSL payload' });
            }
            const commands = dslCompiler.compile(dsl);
            if (!commands.length) {
              return JSON.stringify({ ok: true, applied: 0 });
            }
            applyCommands(commands);
            return JSON.stringify({ ok: true, applied: commands.length });
          }

          return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
        },
        (event) => {
          setProgressEvents((prev) => [...prev, event]);
        },
      );

      const assistantText = result.finalMessage.trim() || 'Done.';
      setChatHistory((prev) => {
        const base: ChatMessage[] = prev.length > 0 && prev[prev.length - 1].role === 'user'
          ? prev
          : [...prev, { role: 'user', content: prompt }];
        return [...base, { role: 'assistant', content: assistantText }];
      });

      if (!result.toolCalls.length) {
        const dsl = dslCompiler.extractDSL(assistantText);
        if (dsl) {
          const commands = dslCompiler.compile(dsl);
          if (commands.length) {
            applyCommands(commands);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChatError(message);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
    } finally {
      setChatStreaming(false);
    }
  };

  const saveModelConfig = async (): Promise<void> => {
    try {
      await modelManager.saveConfig(modelDraft, apiKeyDraft);
      setApiKeyDraft('');
      setModelRevision((v) => v + 1);
      setTestStatus('Saved model profile.');
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const testModelConfig = async (): Promise<void> => {
    const active = modelManager.getActive() ?? modelDraft;
    const result = await modelManager.testConnection(active.id);
    if (result.success) {
      const sampleModels = (result.models ?? []).slice(0, 3);
      const suffix = sampleModels.length > 0 ? ` · models: ${sampleModels.join(', ')}` : '';
      setTestStatus(`Connection OK (${result.latency}ms)${suffix}`);
    } else {
      setTestStatus(`Connection failed: ${result.error ?? 'unknown error'}`);
    }
  };

  return (
    <div className="app-shell">
      <header className="menu-bar">Viga</header>
      <div className="workspace">
        <div
          className="canvas-zone"
          style={{
            ['--ai-panel-width' as string]: `${aiPanelWidth}px`,
            ['--right-panel-width' as string]: `${rightPanelWidth}px`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="canvas"
            style={{ cursor: activeTool === ToolType.Hand ? 'grab' : drawDraft ? 'crosshair' : 'default' }}
            {...mouseHandlers}
          />
          {marqueeBox ? (
            <div
              className="marquee-box"
              style={{
                left: marqueeBox.left,
                top: marqueeBox.top,
                width: marqueeBox.width,
                height: marqueeBox.height,
              }}
            />
          ) : null}
          {rendererError ? <p className="canvas-error">{rendererError}</p> : null}
          <div className="viewport-chip">{Math.round(viewport.zoom * 100)}%</div>
          <div className="tool-dock">
            <ToolBar activeTool={activeTool} onToolChange={setTool} orientation="horizontal" />
          </div>

          <aside className="floating-panel floating-ai-left" style={{ width: aiPanelWidth }}>
            <AiPanel
              chatHistory={chatHistory}
              chatInput={chatInput}
              chatStreaming={chatStreaming}
              progressEvents={progressEvents}
              chatError={chatError}
              onChatInputChange={setChatInput}
              onRun={runAiCommand}
            />
          </aside>

          <div
            className="panel-resizer panel-resizer-ai"
            onMouseDown={(event) => {
              event.preventDefault();
              panelResizeRef.current = { side: 'ai', startX: event.clientX, startWidth: aiPanelWidth };
            }}
          />

          <aside ref={rightStackRef} className="floating-panel floating-right-stack" style={{ width: rightPanelWidth }}>
            <div className="right-stack-pane" style={{ flexBasis: `${Math.round(rightStackSplit * 100)}%` }}>
              <LayerPanel
                nodes={nodes}
                selectedIds={selectedIds}
                onSelectNode={(id, append) => {
                  if (append) {
                    const next = selectedIds.includes(id)
                      ? selectedIds.filter((existing) => existing !== id)
                      : [...selectedIds, id];
                    setSelectedIds(next);
                  } else {
                    setSelectedIds([id]);
                  }
                }}
              />
            </div>
            <div
              className="right-stack-splitter"
              onMouseDown={(event) => {
                event.preventDefault();
                const height = rightStackRef.current?.getBoundingClientRect().height ?? 1;
                rightStackResizeRef.current = {
                  startY: event.clientY,
                  startSplit: rightStackSplit,
                  height,
                };
              }}
            />
            <div className="right-stack-pane right-stack-pane-bottom">
              <PropertiesPanel
                selectedCount={selectedIds.length}
                selectedNode={selectedNode}
                onPatchSelection={updateSelectionStyles}
              />
            </div>
          </aside>

          <div
            className="panel-resizer panel-resizer-right"
            onMouseDown={(event) => {
              event.preventDefault();
              panelResizeRef.current = { side: 'right', startX: event.clientX, startWidth: rightPanelWidth };
            }}
          />
        </div>
      </div>
      <button type="button" className="settings-fab" onClick={() => setSettingsOpen(true)}>Settings</button>
      {settingsOpen ? (
        <div className="settings-backdrop" onClick={() => setSettingsOpen(false)} role="presentation">
          <section className="settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="settings-head">
              <div>
                <strong>AI Settings</strong>
                <span>Configure provider, model, and API key.</span>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
            <div className="settings-grid">
              <label className="settings-field">
                Profile
                <select
                  value={modelDraft.id}
                  onChange={(e) => {
                    const next = modelConfigs.find((cfg) => cfg.id === e.target.value);
                    if (!next) {
                      return;
                    }
                    modelManager.setActive(next.id);
                    setModelDraft(next);
                  }}
                >
                  <option value={modelDraft.id}>{modelDraft.name || modelDraft.id}</option>
                  {modelConfigs
                    .filter((cfg) => cfg.id !== modelDraft.id)
                    .map((cfg) => (
                      <option key={cfg.id} value={cfg.id}>
                        {cfg.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="settings-field">
                Profile Name
                <input
                  value={modelDraft.name}
                  onChange={(e) => setModelDraft((curr) => ({ ...curr, name: e.target.value }))}
                />
              </label>

              <label className="settings-field">
                Provider
                <select
                  value={modelDraft.provider}
                  onChange={() => setModelDraft((curr) => ({ ...curr, provider: 'openai-compatible' }))}
                >
                  <option value="openai-compatible">OpenAI Compatible</option>
                </select>
              </label>

              <label className="settings-field">
                Protocol
                <select
                  value={modelDraft.apiProtocol ?? 'chat-completions'}
                  onChange={(e) => setModelDraft((curr) => ({
                    ...curr,
                    apiProtocol: e.target.value === 'responses' ? 'responses' : 'chat-completions',
                  }))}
                >
                  <option value="chat-completions">Chat Completions</option>
                  <option value="responses">Responses API</option>
                </select>
              </label>

              <label className="settings-field">
                Base URL
                <input
                  value={modelDraft.baseUrl}
                  onChange={(e) => setModelDraft((curr) => ({ ...curr, baseUrl: e.target.value }))}
                />
              </label>

              <label className="settings-field">
                Model
                <input
                  value={modelDraft.modelName}
                  onChange={(e) => setModelDraft((curr) => ({ ...curr, modelName: e.target.value }))}
                />
              </label>

              <label className="settings-field settings-field-full">
                API Key
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                />
              </label>

              <div className="settings-actions settings-field-full">
                <button type="button" onClick={saveModelConfig}>Save</button>
                <button type="button" onClick={testModelConfig}>Test</button>
              </div>

              {testStatus ? <div className="settings-status settings-field-full">{testStatus}</div> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
