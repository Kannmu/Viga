import { z } from 'zod';
import { createRectangleNode } from '@viga/editor-core';
import { CreateNodeCommand, type Command } from '@viga/editor-core';
import type { DSLElement, VigaDSL } from './types';

const elementSchema = z.object({
  id: z.string(),
  type: z.enum(['rectangle', 'ellipse', 'line', 'text']),
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
    ]),
  ),
});

export class DSLCompiler {
  extractDSL(responseText: string): VigaDSL | null {
    const match = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match) {
      return null;
    }
    try {
      const parsed = JSON.parse(match[1]);
      return dslSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  compile(dsl: VigaDSL): Command[] {
    const commands: Command[] = [];

    for (const op of dsl.operations) {
      if (op.action !== 'create') {
        continue;
      }
      commands.push(this.compileCreate(op.element));
    }
    return commands;
  }

  private compileCreate(element: DSLElement): Command {
    if (element.type === 'rectangle') {
      const node = createRectangleNode(
        element.x,
        element.y,
        element.width ?? 120,
        element.height ?? 80,
      );
      node.name = element.name ?? node.name;
      return new CreateNodeCommand(node);
    }

    const fallback = createRectangleNode(
      element.x,
      element.y,
      element.width ?? 120,
      element.height ?? 80,
    );
    fallback.name = element.name ?? element.type;
    return new CreateNodeCommand(fallback);
  }
}
