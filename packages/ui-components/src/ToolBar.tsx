import type { ToolType } from '@viga/editor-core';
import { ToolType as ToolTypes } from '@viga/editor-core';

interface ToolBarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  orientation?: 'vertical' | 'horizontal';
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

export function ToolBar({ activeTool, onToolChange, orientation = 'vertical' }: ToolBarProps): JSX.Element {
  const horizontal = orientation === 'horizontal';

  return (
    <aside className={`viga-toolbar ${horizontal ? 'is-horizontal' : 'is-vertical'}`}>
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => onToolChange(tool.id)}
          title={`${tool.label} (${tool.keyHint})`}
          className={`viga-toolbar-btn ${tool.id === activeTool ? 'is-active' : ''}`}
        >
          <span>{tool.label}</span>
          <span className="viga-toolbar-key">{tool.keyHint}</span>
        </button>
      ))}
    </aside>
  );
}
