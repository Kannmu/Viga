import type { SceneNode } from '@viga/editor-core';

function colorToCss(node: SceneNode): string {
  const fill = node.fills[0];
  if (!fill || fill.type !== 'solid') {
    return '#d1d5db';
  }
  const r = Math.round(fill.color.r * 255);
  const g = Math.round(fill.color.g * 255);
  const b = Math.round(fill.color.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function serializeToSVG(nodes: SceneNode[], width = 1200, height = 800): string {
  const body = nodes
    .map((node) => {
      const fill = colorToCss(node);
      if (node.type === 'rectangle') {
        return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${fill}" />`;
      }
      if (node.type === 'ellipse') {
        return `<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" fill="${fill}" />`;
      }
      if (node.type === 'line') {
        return `<line x1="${node.x}" y1="${node.y}" x2="${node.x + node.width}" y2="${node.y + node.height}" stroke="${fill}" stroke-width="1" />`;
      }
      if (node.type === 'text') {
        return `<text x="${node.x}" y="${node.y + node.fontSize}" font-size="${node.fontSize}" fill="${fill}">${escapeText(node.characters)}</text>`;
      }
      return '';
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>`;
}

function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
