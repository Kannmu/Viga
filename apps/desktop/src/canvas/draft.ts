import type { SceneNode, ToolType } from '@viga/editor-core';

export interface DrawDraft {
  tool: Extract<ToolType, 'rectangle' | 'ellipse' | 'line' | 'pen'>;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface ShapeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_DRAG_DISTANCE = 2;

export function hasMeaningfulDraft(draft: DrawDraft): boolean {
  const dx = Math.abs(draft.currentX - draft.startX);
  const dy = Math.abs(draft.currentY - draft.startY);
  return dx >= MIN_DRAG_DISTANCE || dy >= MIN_DRAG_DISTANCE;
}

export function updateDraftPoint(draft: DrawDraft, x: number, y: number): DrawDraft {
  return {
    ...draft,
    currentX: x,
    currentY: y,
  };
}

export function getDraftGeometry(draft: DrawDraft): ShapeGeometry {
  const dx = draft.currentX - draft.startX;
  const dy = draft.currentY - draft.startY;

  if (draft.tool === 'line' || draft.tool === 'pen') {
    return {
      x: draft.startX,
      y: draft.startY,
      width: dx,
      height: dy,
    };
  }

  return {
    x: Math.min(draft.startX, draft.currentX),
    y: Math.min(draft.startY, draft.currentY),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

export function createPreviewNode(draft: DrawDraft): SceneNode {
  const geometry = getDraftGeometry(draft);
  const shapeType = draft.tool === 'pen' ? 'line' : draft.tool;
  return {
    id: '__draft_preview__',
    type: shapeType,
    name: 'Draft Preview',
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: 0,
    opacity: 0.6,
    visible: true,
    locked: true,
    fills: [{ type: 'solid', color: { r: 0.04, g: 0.43, b: 1, a: 0.85 } }],
    ...(shapeType === 'rectangle' ? { cornerRadii: [0, 0, 0, 0] as [number, number, number, number] } : {}),
  } as SceneNode;
}
