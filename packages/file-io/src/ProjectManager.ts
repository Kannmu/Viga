import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { DocumentData } from '@viga/editor-core';

export interface VigaArchive {
  manifest: {
    version: string;
    createdAt: number;
    updatedAt: number;
    documentName?: string;
    nodeCount?: number;
  };
  document: DocumentData;
}

export class ProjectManager {
  serialize(document: DocumentData, previous?: VigaArchive['manifest']): Uint8Array {
    const now = Date.now();
    const archive: VigaArchive = {
      manifest: {
        version: '1.0.0',
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        documentName: document.name,
        nodeCount: document.nodeOrder.length,
      },
      document,
    };

    const zipped = zipSync({
      'manifest.json': strToU8(JSON.stringify(archive.manifest, null, 2)),
      'document.json': strToU8(JSON.stringify(archive.document, null, 2)),
    });

    return zipped;
  }

  deserialize(data: Uint8Array): VigaArchive {
    const files = unzipSync(data);
    const manifestRaw = files['manifest.json'];
    const documentRaw = files['document.json'];
    if (!manifestRaw || !documentRaw) {
      throw new Error('Invalid .viga archive: missing manifest.json or document.json');
    }

    const manifest = JSON.parse(strFromU8(manifestRaw));
    const document = JSON.parse(strFromU8(documentRaw)) as DocumentData;

    return { manifest, document };
  }
}
