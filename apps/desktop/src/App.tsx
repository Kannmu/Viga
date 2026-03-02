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
  type ModelConfig,
} from '@viga/ai-integration';
import { ToolBar, PropertiesPanel, LayerPanel } from '@viga/ui-components';

class BrowserKeyStore {
  private readonly prefix = 'viga:key:';

  async store(profileId: string, key: string): Promise<void> {
    localStorage.setItem(`${this.prefix}${profileId}`, key);
  }

  async retrieve(profileId: string): Promise<string> {
    const value = localStorage.getItem(`${this.prefix}${profileId}`);
    if (!value) {
      throw new Error('Missing API key for profile');
    }
    return value;
  }

  async remove(profileId: string): Promise<void> {
    localStorage.removeItem(`${this.prefix}${profileId}`);
  }
}

const DEFAULT_MODEL: ModelConfig = {
  id: 'default',
  name: 'Default',
  baseUrl: 'https://api.openai.com',
  modelName: 'gpt-4.1-mini',
  apiKeyRef: 'default',
  maxTokens: 1200,
  temperature: 0.3,
  topP: 1,
};

function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGL2Renderer | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
  const panStateRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [modelDraft, setModelDraft] = useState(DEFAULT_MODEL);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [testStatus, setTestStatus] = useState<string>('');
  const [modelRevision, setModelRevision] = useState(0);

  const activeTool = useEditorStore((s) => s.activeTool);
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

  const keyStore = useMemo(() => new BrowserKeyStore(), []);
  const modelManager = useMemo(() => new ModelConfigManager(keyStore), [keyStore]);
  const aiClient = useMemo(
    () => new OpenAICompatibleClient((profileId) => modelManager.getApiKeyForProfile(profileId)),
    [modelManager],
  );
  const contextBuilder = useMemo(() => new ContextBuilder(documentStore), [documentStore]);
  const promptEngine = useMemo(() => new PromptEngine(), []);
  const dslCompiler = useMemo(() => new DSLCompiler(), []);

  const modelConfigs = useMemo(() => modelManager.list(), [modelManager, modelRevision]);

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
    rendererRef.current.render(nodes, selectedIds);
  }, [nodes, selectedIds, viewport]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
        if (activeTool === ToolType.Rectangle || activeTool === ToolType.Ellipse) {
          createShape(activeTool, point.x, point.y, 160, 100);
          setTool(ToolType.Select);
          return;
        }
        if (activeTool === ToolType.Line) {
          createShape(activeTool, point.x, point.y, 160, 2);
          setTool(ToolType.Select);
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
        if (panStateRef.current.active) {
          const dx = e.clientX - panStateRef.current.lastX;
          const dy = e.clientY - panStateRef.current.lastY;
          panStateRef.current.lastX = e.clientX;
          panStateRef.current.lastY = e.clientY;
          setViewport((curr) => ({ ...curr, panX: curr.panX + dx, panY: curr.panY + dy }));
          return;
        }
        const point = toCanvasPoint(e);
        updatePointerDrag(point.x, point.y);
      },
      onMouseUp: () => {
        panStateRef.current.active = false;
        endPointerDrag();
      },
      onMouseLeave: () => {
        panStateRef.current.active = false;
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
    [activeTool, beginPointerDrag, createShape, createText, endPointerDrag, setTool, updatePointerDrag],
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
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', content: prompt }]);

    const selectionContext = contextBuilder.buildSelectionContext(selectedIds);
    const messages = promptEngine.buildMessages(prompt, selectionContext, chatHistory);
    let assistantText = '';

    try {
      for await (const chunk of aiClient.streamChat(activeModel, messages)) {
        if (chunk.type === 'content') {
          assistantText += chunk.content;
          setChatHistory((prev) => {
            const hasAssistant = prev.length > 0 && prev[prev.length - 1].role === 'assistant';
            if (!hasAssistant) {
              return [...prev, { role: 'assistant', content: assistantText }];
            }
            return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }];
          });
        }
      }

      const dsl = dslCompiler.extractDSL(assistantText);
      if (dsl) {
        const commands = dslCompiler.compile(dsl);
        applyCommands(commands);
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
      setTestStatus(`Connection OK (${result.latency}ms)`);
    } else {
      setTestStatus(`Connection failed: ${result.error ?? 'unknown error'}`);
    }
  };

  return (
    <div className="app-shell">
      <header className="menu-bar">Viga</header>
      <div className="workspace">
        <ToolBar activeTool={activeTool} onToolChange={setTool} />
        <div className="canvas-zone">
          <canvas ref={canvasRef} className="canvas" {...mouseHandlers} />
          {rendererError ? <p className="canvas-error">{rendererError}</p> : null}
          <div className="viewport-chip">{Math.round(viewport.zoom * 100)}%</div>
        </div>
        <PropertiesPanel
          selectedCount={selectedIds.length}
          selectedNode={selectedNode}
          onPatchSelection={updateSelectionStyles}
        />
      </div>
      <div className="bottom-panels">
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
        <section className="ai-panel">
          <div className="ai-panel-head">AI</div>
          <div className="ai-model-grid">
            <select
              value={modelDraft.id}
              onChange={(e) => {
                const next = modelConfigs.find((cfg) => cfg.id === e.target.value);
                if (next) {
                  modelManager.setActive(next.id);
                  setModelDraft(next);
                }
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
            <input
              placeholder="Base URL"
              value={modelDraft.baseUrl}
              onChange={(e) => setModelDraft((curr) => ({ ...curr, baseUrl: e.target.value }))}
            />
            <input
              placeholder="Model"
              value={modelDraft.modelName}
              onChange={(e) => setModelDraft((curr) => ({ ...curr, modelName: e.target.value }))}
            />
            <input
              placeholder="API Key"
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
            />
            <div className="ai-actions">
              <button type="button" onClick={saveModelConfig}>Save</button>
              <button type="button" onClick={testModelConfig}>Test</button>
            </div>
            {testStatus ? <div className="ai-status">{testStatus}</div> : null}
          </div>

          <div className="ai-chat-log">
            {chatHistory.length === 0 ? <div className="ai-empty">Describe what to draw or edit.</div> : null}
            {chatHistory.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`ai-msg ai-msg-${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>

          <div className="ai-chat-input-row">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Create a simple landing hero with title and button"
              className="ai-chat-input"
            />
            <button type="button" onClick={runAiCommand} disabled={chatStreaming}>
              {chatStreaming ? 'Running...' : 'Run'}
            </button>
          </div>
          {chatError ? <div className="ai-error">{chatError}</div> : null}
        </section>
      </div>
    </div>
  );
}

export default App;
