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
export declare function updateDraftPoint(draft: DrawDraft, x: number, y: number): DrawDraft;
export declare function getDraftGeometry(draft: DrawDraft): ShapeGeometry;
export declare function createPreviewNode(draft: DrawDraft): SceneNode;
