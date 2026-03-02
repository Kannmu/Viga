interface PropertiesPanelProps {
  selectedCount: number;
}

export function PropertiesPanel({ selectedCount }: PropertiesPanelProps): JSX.Element {
  return (
    <aside style={{ borderLeft: '1px solid #d1d5db', background: '#fff', padding: 12 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Properties</h3>
      <div style={{ fontSize: 13, color: '#374151' }}>Selected: {selectedCount}</div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
        Fill and stroke controls are scaffolded for phase 1 MVP.
      </div>
    </aside>
  );
}
