import type { NodeId, SceneNode } from '@viga/editor-core';

interface LayerPanelProps {
  nodes: SceneNode[];
  selectedIds: NodeId[];
  onSelectNode?: (id: NodeId, append: boolean) => void;
}

export function LayerPanel({ nodes, selectedIds, onSelectNode }: LayerPanelProps): JSX.Element {
  return (
    <section className="viga-panel viga-layer-panel">
      <div className="viga-panel-title">Layers</div>
      {[...nodes].reverse().map((node) => (
        <div
          key={node.id}
          onClick={(event) => onSelectNode?.(node.id, event.shiftKey)}
          className={`viga-layer-item ${selectedIds.includes(node.id) ? 'is-selected' : ''}`}
          role={onSelectNode ? 'button' : undefined}
        >
          {node.name} ({node.type})
        </div>
      ))}
      {nodes.length === 0 ? <div className="viga-empty">No layers yet.</div> : null}
    </section>
  );
}
