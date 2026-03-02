import { useEffect, useMemo, useRef } from 'react';
import { createEmptyDocument, ToolType, useEditorStore } from '@viga/editor-core';
import { WebGL2Renderer } from '@viga/canvas-engine';
import { ToolBar, PropertiesPanel, LayerPanel } from '@viga/ui-components';

function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGL2Renderer | null>(null);

  const activeTool = useEditorStore((s) => s.activeTool);
  const nodes = useEditorStore((s) => s.documentStore.getRenderableNodes());
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setTool = useEditorStore((s) => s.setTool);
  const createRectangle = useEditorStore((s) => s.createRectangle);
  const selectAt = useEditorStore((s) => s.selectAt);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const loadDocument = useEditorStore((s) => s.loadDocument);

  useEffect(() => {
    loadDocument(createEmptyDocument());
  }, [loadDocument]);

  useEffect(() => {
    if (!canvasRef.current || rendererRef.current) {
      return;
    }
    const renderer = new WebGL2Renderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    return () => renderer.destroy();
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(nodes, selectedIds);
    }
  }, [nodes, selectedIds]);

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

  const mouseHandlers = useMemo(
    () => ({
      onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (activeTool === ToolType.Rectangle) {
          createRectangle(x, y, 160, 100);
          setTool(ToolType.Select);
        } else {
          selectAt(x, y, e.shiftKey);
        }
      },
    }),
    [activeTool, createRectangle, selectAt, setTool],
  );

  return (
    <div className="app-shell">
      <header className="menu-bar">Viga</header>
      <div className="workspace">
        <ToolBar activeTool={activeTool} onToolChange={setTool} />
        <div className="canvas-zone">
          <canvas ref={canvasRef} className="canvas" {...mouseHandlers} />
        </div>
        <PropertiesPanel selectedCount={selectedIds.length} />
      </div>
      <LayerPanel nodes={nodes} selectedIds={selectedIds} />
    </div>
  );
}

export default App;
