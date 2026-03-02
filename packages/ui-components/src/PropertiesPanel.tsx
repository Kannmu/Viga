import type { EditableNodePatch, SceneNode } from '@viga/editor-core';

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
  const fillAlpha = fill?.type === 'solid' ? Math.round(fill.color.a * 100) : 100;

  const showControls = Boolean(selectedNode && onPatchSelection);
  const rectangleNode = selectedNode?.type === 'rectangle' ? selectedNode : null;
  const textNode = selectedNode?.type === 'text' ? selectedNode : null;

  const patchNumber = (key: keyof EditableNodePatch, value: string): void => {
    if (!onPatchSelection) {
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    onPatchSelection({ [key]: parsed } as EditableNodePatch);
  };

  const patchFill = (hex: string, alphaPercent: number): void => {
    if (!onPatchSelection) {
      return;
    }
    const color = hexToColor(hex);
    const safeAlpha = Number.isFinite(alphaPercent) ? alphaPercent : 100;
    color.a = Math.max(0, Math.min(1, safeAlpha / 100));
    onPatchSelection({ fills: [{ type: 'solid', color }] });
  };

  return (
    <aside className="viga-panel viga-properties-panel">
      <h3 className="viga-panel-title">Design</h3>
      <div className="viga-panel-subtitle">Selected: {selectedCount}</div>
      {showControls ? (
        <div className="viga-form-grid">
          <label className="viga-field">
            Name
            <input
              value={selectedNode?.name ?? ''}
              onChange={(event) => onPatchSelection?.({ name: event.currentTarget.value })}
              className="viga-input"
            />
          </label>

          <div className="viga-section-label">Layout</div>

          <div className="viga-numeric-grid viga-numeric-grid-2">
            <label className="viga-field">
              X
              <input
                className="viga-input"
                type="number"
                value={Math.round(selectedNode?.x ?? 0)}
                onChange={(event) => patchNumber('x', event.currentTarget.value)}
              />
            </label>
            <label className="viga-field">
              Y
              <input
                className="viga-input"
                type="number"
                value={Math.round(selectedNode?.y ?? 0)}
                onChange={(event) => patchNumber('y', event.currentTarget.value)}
              />
            </label>
          </div>

          <div className="viga-numeric-grid viga-numeric-grid-3">
            <label className="viga-field">
              W
              <input
                className="viga-input"
                type="number"
                min={1}
                value={Math.round(selectedNode?.width ?? 0)}
                onChange={(event) => patchNumber('width', event.currentTarget.value)}
              />
            </label>
            <label className="viga-field">
              H
              <input
                className="viga-input"
                type="number"
                min={1}
                value={Math.round(selectedNode?.height ?? 0)}
                onChange={(event) => patchNumber('height', event.currentTarget.value)}
              />
            </label>
            <label className="viga-field">
              R
              <input
                className="viga-input"
                type="number"
                value={Math.round(selectedNode?.rotation ?? 0)}
                onChange={(event) => patchNumber('rotation', event.currentTarget.value)}
              />
            </label>
          </div>

          {rectangleNode ? (
            <label className="viga-field">
              Corner Radius
              <input
                className="viga-input"
                type="number"
                min={0}
                value={Math.round(rectangleNode.cornerRadii[0])}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (Number.isNaN(value)) {
                    return;
                  }
                  const radius = Math.max(0, value);
                  onPatchSelection?.({ cornerRadii: [radius, radius, radius, radius] });
                }}
              />
            </label>
          ) : null}

          {textNode ? (
            <>
              <label className="viga-field">
                Text
                <textarea
                  className="viga-input viga-textarea"
                  value={textNode.characters}
                  onChange={(event) => onPatchSelection?.({ characters: event.currentTarget.value })}
                />
              </label>
              <label className="viga-field">
                Font Size
                <input
                  className="viga-input"
                  type="number"
                  min={1}
                  value={Math.round(textNode.fontSize)}
                  onChange={(event) => patchNumber('fontSize', event.currentTarget.value)}
                />
              </label>
            </>
          ) : null}

          <div className="viga-section-label">Appearance</div>

          <label className="viga-field">
            Fill
            <div className="viga-inline-row">
              <input
                type="color"
                value={fillHex}
                onChange={(event) => patchFill(event.currentTarget.value, fillAlpha)}
                className="viga-color"
              />
              <input
                className="viga-input"
                type="number"
                min={0}
                max={100}
                value={fillAlpha}
                onChange={(event) => patchFill(fillHex, Number(event.currentTarget.value))}
              />
            </div>
          </label>

          <label className="viga-field">
            Opacity
            <div className="viga-inline-row">
              <input
                className="viga-range"
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
              <input
                className="viga-input"
                type="number"
                min={0}
                max={100}
                value={Math.round((selectedNode?.opacity ?? 1) * 100)}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  onPatchSelection?.({ opacity: value / 100 });
                }}
              />
            </div>
          </label>

          <label className="viga-field viga-toggle-row">
            <span>Visible</span>
            <input
              type="checkbox"
              checked={selectedNode?.visible ?? true}
              onChange={(event) => onPatchSelection?.({ visible: event.currentTarget.checked })}
            />
          </label>

          <label className="viga-field viga-toggle-row">
            <span>Locked</span>
            <input
              type="checkbox"
              checked={selectedNode?.locked ?? false}
              onChange={(event) => onPatchSelection?.({ locked: event.currentTarget.checked })}
            />
          </label>
        </div>
      ) : (
        <div className="viga-empty">
          Select one element to edit style properties.
        </div>
      )}
    </aside>
  );
}

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
