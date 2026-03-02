import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyDocument, ToolType, useEditorStore } from '@viga/editor-core';
import { WebGL2Renderer } from '@viga/canvas-engine';
import { ContextBuilder, DSLCompiler, ModelConfigManager, OpenAICompatibleClient, PromptEngine, } from '@viga/ai-integration';
import { ToolBar, PropertiesPanel, LayerPanel } from '@viga/ui-components';
import { AiPanel } from './components/AiPanel';
import { BrowserKeyStore } from './ai/browserKeyStore';
import { DEFAULT_MODEL } from './ai/defaultModel';
import { createPreviewNode, getDraftGeometry, updateDraftPoint } from './canvas/draft';
function App() {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const [rendererError, setRendererError] = useState(null);
    const [viewport, setViewport] = useState({ panX: 0, panY: 0, zoom: 1 });
    const [leftPanelWidth, setLeftPanelWidth] = useState(300);
    const [rightPanelWidth, setRightPanelWidth] = useState(300);
    const panStateRef = useRef({
        active: false,
        lastX: 0,
        lastY: 0,
    });
    const panelResizeRef = useRef(null);
    const [drawDraft, setDrawDraft] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [chatStreaming, setChatStreaming] = useState(false);
    const [chatError, setChatError] = useState(null);
    const [modelDraft, setModelDraft] = useState(DEFAULT_MODEL);
    const [apiKeyDraft, setApiKeyDraft] = useState('');
    const [testStatus, setTestStatus] = useState('');
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
    const selectedNode = useMemo(() => (selectedIds.length === 1 ? documentStore.getNode(selectedIds[0]) : null), [documentStore, documentVersion, selectedIds]);
    const previewNodes = useMemo(() => (drawDraft ? [createPreviewNode(drawDraft)] : []), [drawDraft]);
    const keyStore = useMemo(() => new BrowserKeyStore(), []);
    const modelManager = useMemo(() => new ModelConfigManager(keyStore), [keyStore]);
    const aiClient = useMemo(() => new OpenAICompatibleClient((profileId) => modelManager.getApiKeyForProfile(profileId)), [modelManager]);
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
        }
        catch (error) {
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
        const onKeyDown = (e) => {
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
        const maxWidth = 460;
        const onMouseMove = (event) => {
            const draft = panelResizeRef.current;
            if (!draft) {
                return;
            }
            if (draft.side === 'left') {
                const next = Math.max(minWidth, Math.min(maxWidth, draft.startWidth + (event.clientX - draft.startX)));
                setLeftPanelWidth(next);
            }
            else {
                const next = Math.max(minWidth, Math.min(maxWidth, draft.startWidth - (event.clientX - draft.startX)));
                setRightPanelWidth(next);
            }
        };
        const onMouseUp = () => {
            panelResizeRef.current = null;
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);
    const toCanvasPoint = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (!rendererRef.current) {
            return { x, y };
        }
        return rendererRef.current.screenToCanvas(x, y);
    };
    const beginPan = (event) => {
        panStateRef.current = {
            active: true,
            lastX: event.clientX,
            lastY: event.clientY,
        };
    };
    const mouseHandlers = useMemo(() => ({
        onMouseDown: (e) => {
            if (e.button === 1 || activeTool === ToolType.Hand) {
                e.preventDefault();
                beginPan(e);
                return;
            }
            const point = toCanvasPoint(e);
            if (activeTool === ToolType.Rectangle
                || activeTool === ToolType.Ellipse
                || activeTool === ToolType.Line
                || activeTool === ToolType.Pen) {
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
        onMouseMove: (e) => {
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
        onMouseUp: (e) => {
            panStateRef.current.active = false;
            if (drawDraft) {
                const point = toCanvasPoint(e);
                const finalDraft = updateDraftPoint(drawDraft, point.x, point.y);
                const geometry = getDraftGeometry(finalDraft);
                setDrawDraft(null);
                if (finalDraft.tool === ToolType.Line || finalDraft.tool === ToolType.Pen) {
                    createShape(ToolType.Line, geometry.x, geometry.y, geometry.width, geometry.height);
                    return;
                }
                createShape(finalDraft.tool, geometry.x, geometry.y, geometry.width, geometry.height);
                return;
            }
            endPointerDrag();
        },
        onMouseLeave: () => {
            panStateRef.current.active = false;
            setDrawDraft(null);
            endPointerDrag();
        },
        onWheel: (e) => {
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
    }), [activeTool, beginPointerDrag, createShape, createText, drawDraft, endPointerDrag, setTool, updatePointerDrag]);
    const runAiCommand = async () => {
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setChatError(message);
            setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
        }
        finally {
            setChatStreaming(false);
        }
    };
    const saveModelConfig = async () => {
        try {
            await modelManager.saveConfig(modelDraft, apiKeyDraft);
            setModelRevision((v) => v + 1);
            setTestStatus('Saved model profile.');
        }
        catch (error) {
            setTestStatus(error instanceof Error ? error.message : String(error));
        }
    };
    const testModelConfig = async () => {
        const active = modelManager.getActive() ?? modelDraft;
        const result = await modelManager.testConnection(active.id);
        if (result.success) {
            setTestStatus(`Connection OK (${result.latency}ms)`);
        }
        else {
            setTestStatus(`Connection failed: ${result.error ?? 'unknown error'}`);
        }
    };
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "menu-bar", children: "Viga" }), _jsx("div", { className: "workspace", children: _jsxs("div", { className: "canvas-zone", style: {
                        ['--left-panel-width']: `${leftPanelWidth}px`,
                        ['--right-panel-width']: `${rightPanelWidth}px`,
                    }, children: [_jsx("canvas", { ref: canvasRef, className: "canvas", style: { cursor: activeTool === ToolType.Hand ? 'grab' : drawDraft ? 'crosshair' : 'default' }, ...mouseHandlers }), rendererError ? _jsx("p", { className: "canvas-error", children: rendererError }) : null, _jsxs("div", { className: "viewport-chip", children: [Math.round(viewport.zoom * 100), "%"] }), _jsx("div", { className: "tool-dock", children: _jsx(ToolBar, { activeTool: activeTool, onToolChange: setTool, orientation: "horizontal" }) }), _jsxs("aside", { className: "floating-panel floating-left", style: { width: leftPanelWidth }, children: [_jsx(LayerPanel, { nodes: nodes, selectedIds: selectedIds, onSelectNode: (id, append) => {
                                        if (append) {
                                            const next = selectedIds.includes(id)
                                                ? selectedIds.filter((existing) => existing !== id)
                                                : [...selectedIds, id];
                                            setSelectedIds(next);
                                        }
                                        else {
                                            setSelectedIds([id]);
                                        }
                                    } }), _jsx(AiPanel, { modelDraft: modelDraft, modelConfigs: modelConfigs, chatHistory: chatHistory, chatInput: chatInput, chatStreaming: chatStreaming, chatError: chatError, testStatus: testStatus, apiKeyDraft: apiKeyDraft, onChatInputChange: setChatInput, onSelectModel: (modelId) => {
                                        const next = modelConfigs.find((cfg) => cfg.id === modelId);
                                        if (!next) {
                                            return;
                                        }
                                        modelManager.setActive(next.id);
                                        setModelDraft(next);
                                    }, onPatchModelDraft: (patch) => setModelDraft((curr) => ({ ...curr, ...patch })), onApiKeyDraftChange: setApiKeyDraft, onRun: runAiCommand, onSaveModel: saveModelConfig, onTestModel: testModelConfig })] }), _jsx("div", { className: "panel-resizer panel-resizer-left", onMouseDown: (event) => {
                                event.preventDefault();
                                panelResizeRef.current = { side: 'left', startX: event.clientX, startWidth: leftPanelWidth };
                            } }), _jsx("aside", { className: "floating-panel floating-right", style: { width: rightPanelWidth }, children: _jsx(PropertiesPanel, { selectedCount: selectedIds.length, selectedNode: selectedNode, onPatchSelection: updateSelectionStyles }) }), _jsx("div", { className: "panel-resizer panel-resizer-right", onMouseDown: (event) => {
                                event.preventDefault();
                                panelResizeRef.current = { side: 'right', startX: event.clientX, startWidth: rightPanelWidth };
                            } })] }) })] }));
}
export default App;
//# sourceMappingURL=App.js.map