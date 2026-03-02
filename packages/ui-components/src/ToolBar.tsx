import type { ToolType } from '@viga/editor-core';
import { ToolType as ToolTypes } from '@viga/editor-core';

interface ToolBarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

const TOOLS: { id: ToolType; label: string }[] = [
  { id: ToolTypes.Select, label: 'V' },
  { id: ToolTypes.Rectangle, label: 'R' },
  { id: ToolTypes.Ellipse, label: 'O' },
  { id: ToolTypes.Line, label: 'L' },
  { id: ToolTypes.Pen, label: 'P' },
  { id: ToolTypes.Text, label: 'T' },
  { id: ToolTypes.Hand, label: 'H' },
];

export function ToolBar({ activeTool, onToolChange }: ToolBarProps): JSX.Element {
  return (
    <aside style={{ borderRight: '1px solid #d1d5db', background: '#fff', padding: 8 }}>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          style={{
            display: 'block',
            width: '100%',
            marginBottom: 8,
            height: 38,
            borderRadius: 8,
            border: tool.id === activeTool ? '2px solid #3b82f6' : '1px solid #d1d5db',
            background: tool.id === activeTool ? '#dbeafe' : '#f9fafb',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {tool.label}
        </button>
      ))}
    </aside>
  );
}
