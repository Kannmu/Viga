import type { EditableNodePatch, SceneNode } from '@viga/editor-core';
import type { CSSProperties } from 'react';

interface PropertiesPanelProps {
  selectedCount: number;
  selectedNode?: SceneNode | null;
  onPatchSelection?: (patch: EditableNodePatch) => void;
}

export function PropertiesPanel({ selectedCount, selectedNode, onPatchSelection }: PropertiesPanelProps): JSX.Element {
  const fill = selectedNode?.fills[0];
  const fillHex =
    fill?.type === 'solid'
      ? `#${toHex(fill.color.r)}${toHex(fill.color.g)}${toHex(fill.color.b)}`
      : '#d1d5db';

  const showControls = Boolean(selectedNode && onPatchSelection);

  return (
    <aside style={{ borderLeft: '1px solid #d1d5db', background: '#fff', padding: 12 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Properties</h3>
      <div style={{ fontSize: 13, color: '#374151' }}>Selected: {selectedCount}</div>
      {showControls ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#4b5563' }}>
            Name
            <input
              value={selectedNode?.name ?? ''}
              onChange={(event) => onPatchSelection?.({ name: event.currentTarget.value })}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#4b5563' }}>
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((selectedNode?.opacity ?? 1) * 100)}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                onPatchSelection?.({ opacity: value / 100 });
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#4b5563' }}>
            Fill
            <input
              type="color"
              value={fillHex}
              onChange={(event) => {
                const hex = event.currentTarget.value;
                const color = hexToColor(hex);
                onPatchSelection?.({ fills: [{ type: 'solid', color }] });
              }}
              style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 6, padding: 2 }}
            />
          </label>
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
          Select one element to edit style properties.
        </div>
      )}
    </aside>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  height: 30,
  padding: '0 8px',
};

function toHex(channel: number): string {
  const value = Math.round(Math.max(0, Math.min(1, channel)) * 255);
  return value.toString(16).padStart(2, '0');
}

function hexToColor(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '');
  const parse = (start: number) => Number.parseInt(clean.slice(start, start + 2), 16) / 255;
  return {
    r: parse(0),
    g: parse(2),
    b: parse(4),
    a: 1,
  };
}
