import { z } from 'zod';
import {
  createEllipseNode,
  createLineNode,
  createRectangleNode,
  createTextNode,
} from '@viga/editor-core';
import {
  CreateNodeCommand,
  DeleteNodesCommand,
  UpdateNodesCommand,
  type Command,
} from '@viga/editor-core';
import type { EditableNodePatch } from '@viga/editor-core';
import type { DSLElement, VigaDSL } from './types';

const elementSchema = z.object({
  id: z.string(),
  type: z.enum(['rectangle', 'ellipse', 'line', 'text', 'frame', 'polygon', 'star', 'path', 'group']),
  name: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fill: z.string().optional(),
});

const dslSchema = z.object({
  version: z.literal('1.0'),
  operations: z.array(
    z.discriminatedUnion('action', [
      z.object({
        action: z.literal('create'),
        element: elementSchema,
        parentId: z.string().optional(),
        insertIndex: z.number().optional(),
      }),
      z.object({
        action: z.literal('modify'),
        targetId: z.string(),
        properties: z.record(z.unknown()),
      }),
      z.object({
        action: z.literal('delete'),
        targetId: z.string(),
      }),
      z.object({
        action: z.literal('group'),
        elementIds: z.array(z.string()),
        name: z.string(),
      }),
      z.object({
        action: z.literal('align'),
        elementIds: z.array(z.string()),
        alignment: z.enum([
          'left',
          'center',
          'right',
          'top',
          'middle',
          'bottom',
          'distribute-h',
          'distribute-v',
        ]),
      }),
      z.object({
        action: z.literal('style'),
        targetId: z.string(),
        properties: z.record(z.unknown()),
      }),
    ]),
  ),
});

function parseHexFill(input: unknown): { type: 'solid'; color: { r: number; g: number; b: number; a: number } }[] | null {
  if (typeof input !== 'string') {
    return null;
  }
  const value = input.trim();
  const m = value.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) {
    return null;
  }
  const hex = m[1];
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  return [{ type: 'solid', color: { r, g, b, a: 1 } }];
}

export class DSLCompiler {
  extractDSL(responseText: string): VigaDSL | null {
    const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const payload = match ? match[1] : responseText;
    try {
      const parsed = JSON.parse(payload);
      return dslSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  compile(dsl: VigaDSL): Command[] {
    const commands: Command[] = [];
    const createdIdMap = new Map<string, string>();

    for (const op of dsl.operations) {
      if (op.action === 'create') {
        const { command, createdId } = this.compileCreate(op.element);
        createdIdMap.set(op.element.id, createdId);
        commands.push(command);
        continue;
      }
      if (op.action === 'delete') {
        const targetId = this.resolveNodeId(op.targetId, createdIdMap);
        commands.push(new DeleteNodesCommand([targetId]));
        continue;
      }
      if (op.action === 'modify' || op.action === 'style') {
        const targetId = this.resolveNodeId(op.targetId, createdIdMap);
        const patch: EditableNodePatch = {};
        const source = op.properties;

        if (typeof source.x === 'number') patch.x = source.x;
        if (typeof source.y === 'number') patch.y = source.y;
        if (typeof source.width === 'number') patch.width = source.width;
        if (typeof source.height === 'number') patch.height = source.height;
        if (typeof source.name === 'string') patch.name = source.name;
        if (typeof source.opacity === 'number') patch.opacity = source.opacity;
        if (typeof source.rotation === 'number') patch.rotation = source.rotation;
        if (typeof source.text === 'string') patch.characters = source.text;
        if (typeof source.characters === 'string') patch.characters = source.characters;
        if (typeof source.fontSize === 'number') patch.fontSize = source.fontSize;

        const fill = parseHexFill(source.fill);
        if (fill) {
          patch.fills = fill;
        }

        if (Object.keys(patch).length > 0) {
          commands.push(new UpdateNodesCommand([targetId], patch));
        }
        continue;
      }

      // group/align are accepted by schema but not yet compiled in MVP scaffold
    }
    return commands;
  }

  private resolveNodeId(id: string, createdIdMap: Map<string, string>): string {
    return createdIdMap.get(id) ?? id;
  }

  private compileCreate(element: DSLElement): { command: Command; createdId: string } {
    const fill = parseHexFill(element.fill);

    if (element.type === 'rectangle') {
      const node = createRectangleNode(
        element.x,
        element.y,
        element.width ?? 120,
        element.height ?? 80,
      );
      node.name = element.name ?? node.name;
      if (fill) {
        node.fills = fill;
      }
      return { command: new CreateNodeCommand(node), createdId: node.id };
    }

    if (element.type === 'ellipse') {
      const node = createEllipseNode(
        element.x,
        element.y,
        element.width ?? 120,
        element.height ?? 80,
      );
      node.name = element.name ?? 'Ellipse';
      if (fill) {
        node.fills = fill;
      }
      return { command: new CreateNodeCommand(node), createdId: node.id };
    }

    if (element.type === 'line') {
      const node = createLineNode(
        element.x,
        element.y,
        element.width ?? 140,
        element.height ?? 0,
      );
      node.name = element.name ?? 'Line';
      if (fill) {
        node.fills = fill;
      }
      return { command: new CreateNodeCommand(node), createdId: node.id };
    }

    if (element.type === 'text') {
      const node = createTextNode(element.x, element.y, element.text ?? 'Text');
      if (typeof element.width === 'number') {
        node.width = element.width;
      }
      if (typeof element.height === 'number') {
        node.height = element.height;
      }
      if (typeof element.fontSize === 'number') {
        node.fontSize = element.fontSize;
      }
      node.name = element.name ?? 'Text';
      if (fill) {
        node.fills = fill;
      }
      return { command: new CreateNodeCommand(node), createdId: node.id };
    }

    const fallback = createRectangleNode(
      element.x,
      element.y,
      element.width ?? 120,
      element.height ?? 80,
    );
    fallback.name = element.name ?? element.type;
    if (fill) {
      fallback.fills = fill;
    }
    return { command: new CreateNodeCommand(fallback), createdId: fallback.id };
  }
}
