import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyDocument, ToolType, useEditorStore } from '@viga/editor-core';
import { WebGL2Renderer } from '@viga/canvas-engine';
import { ToolBar, PropertiesPanel, LayerPanel } from '@viga/ui-components';
function App() {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const [rendererError, setRendererError] = useState(null);
    const activeTool = useEditorStore((s) => s.activeTool);
    const documentStore = useEditorStore((s) => s.documentStore);
    const documentVersion = useEditorStore((s) => s.documentVersion);
    const selectedIds = useEditorStore((s) => s.selectedIds);
    const setTool = useEditorStore((s) => s.setTool);
    const createRectangle = useEditorStore((s) => s.createRectangle);
    const selectAt = useEditorStore((s) => s.selectAt);
    const deleteSelection = useEditorStore((s) => s.deleteSelection);
    const undo = useEditorStore((s) => s.undo);
    const redo = useEditorStore((s) => s.redo);
    const loadDocument = useEditorStore((s) => s.loadDocument);
    const nodes = useMemo(() => documentStore.getRenderableNodes(), [documentStore, documentVersion]);
    useEffect(() => {
        loadDocument(createEmptyDocument());
    }, [loadDocument]);
    useEffect(() => {
        if (!canvasRef.current || rendererRef.current) {
            return;
        }
        try {
            const renderer = new WebGL2Renderer(canvasRef.current);
            rendererRef.current = renderer;
            renderer.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
            setRendererError(null);
            return () => renderer.destroy();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Renderer initialization failed';
            setRendererError(message);
            console.error('Canvas renderer failed to initialize:', error);
            return;
        }
    }, []);
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.render(nodes, selectedIds);
        }
    }, [nodes, selectedIds]);
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
            if (e.key.toLowerCase() === 'v') {
                setTool(ToolType.Select);
            }
            if (e.key.toLowerCase() === 'r') {
                setTool(ToolType.Rectangle);
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelection();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [deleteSelection, redo, setTool, undo]);
    const mouseHandlers = useMemo(() => ({
        onMouseDown: (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (activeTool === ToolType.Rectangle) {
                createRectangle(x, y, 160, 100);
                setTool(ToolType.Select);
            }
            else {
                selectAt(x, y, e.shiftKey);
            }
        },
    }), [activeTool, createRectangle, selectAt, setTool]);
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "menu-bar", children: "Viga" }), _jsxs("div", { className: "workspace", children: [_jsx(ToolBar, { activeTool: activeTool, onToolChange: setTool }), _jsxs("div", { className: "canvas-zone", children: [_jsx("canvas", { ref: canvasRef, className: "canvas", ...mouseHandlers }), rendererError ? _jsx("p", { className: "canvas-error", children: rendererError }) : null] }), _jsx(PropertiesPanel, { selectedCount: selectedIds.length })] }), _jsx(LayerPanel, { nodes: nodes, selectedIds: selectedIds })] }));
}
export default App;
//# sourceMappingURL=App.js.map