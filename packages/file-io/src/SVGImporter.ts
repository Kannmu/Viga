import { createRectangleNode, type SceneNode } from '@viga/editor-core';

export class SVGImporter {
  import(svgContent: string): SceneNode[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const nodes: SceneNode[] = [];

    const rects = doc.querySelectorAll('rect');
    for (let i = 0; i < rects.length; i += 1) {
      const rect = rects.item(i);
      if (!rect) {
        continue;
      }
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      const width = parseFloat(rect.getAttribute('width') || '0');
      const height = parseFloat(rect.getAttribute('height') || '0');
      const node = createRectangleNode(x, y, width, height);
      node.name = rect.getAttribute('id') || 'Imported Rect';
      nodes.push(node);
    }

    return nodes;
  }
}
