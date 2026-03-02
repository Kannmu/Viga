import type { NodeId, SceneNode } from '@viga/editor-core';

interface LayerPanelProps {
  nodes: SceneNode[];
  selectedIds: NodeId[];
  onSelectNode?: (id: NodeId, append: boolean) => void;
}

export function LayerPanel({ nodes, selectedIds, onSelectNode }: LayerPanelProps): JSX.Element {
  return (
    <section style={{ borderTop: '1px solid #d1d5db', background: '#fff', padding: 10, overflow: 'auto' }}>
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Layers</div>
      {[...nodes].reverse().map((node) => (
        <div
          key={node.id}
          onClick={(event) => onSelectNode?.(node.id, event.shiftKey)}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            marginBottom: 4,
            background: selectedIds.includes(node.id) ? '#dbeafe' : '#f9fafb',
            border: '1px solid #e5e7eb',
            fontSize: 12,
            cursor: onSelectNode ? 'pointer' : 'default',
          }}
        >
          {node.name} ({node.type})
        </div>
      ))}
    </section>
  );
}
