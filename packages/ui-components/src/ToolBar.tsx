import type { ToolType } from '@viga/editor-core';
import { ToolType as ToolTypes } from '@viga/editor-core';

interface ToolBarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const TOOLS: { id: ToolType; label: string; keyHint: string }[] = [
  { id: ToolTypes.Select, label: 'Select', keyHint: 'V' },
  { id: ToolTypes.Rectangle, label: 'Rectangle', keyHint: 'R' },
  { id: ToolTypes.Ellipse, label: 'Ellipse', keyHint: 'O' },
  { id: ToolTypes.Line, label: 'Line', keyHint: 'L' },
  { id: ToolTypes.Pen, label: 'Pen', keyHint: 'P' },
  { id: ToolTypes.Text, label: 'Text', keyHint: 'T' },
  { id: ToolTypes.Hand, label: 'Hand', keyHint: 'H' },
];

export function ToolBar({ activeTool, onToolChange }: ToolBarProps): JSX.Element {
  return (
    <aside style={{ borderRight: '1px solid #d1d5db', background: '#fff', padding: 8 }}>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          title={`${tool.label} (${tool.keyHint})`}
          style={{
            display: 'block',
            width: '100%',
            marginBottom: 8,
            minHeight: 38,
            borderRadius: 8,
            border: tool.id === activeTool ? '2px solid #3b82f6' : '1px solid #d1d5db',
            background: tool.id === activeTool ? '#dbeafe' : '#f9fafb',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
            padding: '7px 9px',
            fontSize: 12,
          }}
        >
          {tool.label}
          <span style={{ float: 'right', opacity: 0.65 }}>{tool.keyHint}</span>
        </button>
      ))}
    </aside>
  );
}
