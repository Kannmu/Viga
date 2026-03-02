import type { NodeId, SceneNode } from '@viga/editor-core';

interface LayerPanelProps {
  nodes: SceneNode[];
  selectedIds: NodeId[];
}

export function LayerPanel({ nodes, selectedIds }: LayerPanelProps): JSX.Element {
  return (
    <section style={{ borderTop: '1px solid #d1d5db', background: '#fff', padding: 10, overflow: 'auto' }}>
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Layers</div>
      {nodes.map((node) => (
        <div
          key={node.id}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            marginBottom: 4,
            background: selectedIds.includes(node.id) ? '#dbeafe' : '#f9fafb',
            border: '1px solid #e5e7eb',
            fontSize: 12,
          }}
        >
          {node.name} ({node.type})
        </div>
      ))}
    </section>
  );
}
