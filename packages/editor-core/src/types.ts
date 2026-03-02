export type NodeId = string;

export type ToolType =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'pen'
  | 'text'
  | 'hand';

export const ToolType = {
  Select: 'select',
  Rectangle: 'rectangle',
  Ellipse: 'ellipse',
  Line: 'line',
  Pen: 'pen',
  Text: 'text',
  Hand: 'hand',
} as const;

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PaintSolid {
  type: 'solid';
  color: Color;
}

export type Paint = PaintSolid;

export interface BaseNode {
  id: NodeId;
  type: 'rectangle' | 'ellipse' | 'line' | 'text';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  fills: Paint[];
}

export interface RectangleNode extends BaseNode {
  type: 'rectangle';
  cornerRadii: [number, number, number, number];
}

export interface EllipseNode extends BaseNode {
  type: 'ellipse';
}

export interface LineNode extends BaseNode {
  type: 'line';
}

export interface TextNode extends BaseNode {
  type: 'text';
  characters: string;
  fontSize: number;
}

export type SceneNode = RectangleNode | EllipseNode | LineNode | TextNode;

export interface DocumentData {
  id: string;
  name: string;
  version: number;
  nodeOrder: NodeId[];
  nodes: Record<NodeId, SceneNode>;
}

export interface HitResult {
  nodeId: NodeId;
}
