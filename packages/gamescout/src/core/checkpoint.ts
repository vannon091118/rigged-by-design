/** Checkpoints and pixel-diff comparison.
 *
 * Compares two checkpoints using pixelmatch, image dimensions, URL,
 * title, and optional observation data. Visual equality does not
 * prove semantic equality.
 */

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Checkpoint, CompareResult } from './types.js';

export class CheckpointController {
  private checkpoints: Map<string, Checkpoint> = new Map();

  createCheckpoint(
    name: string,
    observation: unknown | null,
    screenshotBase64: string,
    url: string,
    title: string
  ): Checkpoint {
    const id = this.createCheckpointId(name);
    const checkpoint: Checkpoint = {
      id,
      name: name || `checkpoint-${id}`,
      timestamp: new Date().toISOString(),
      url,
      title,
      screenshotBase64,
      observation,
    };
    this.checkpoints.set(id, checkpoint);
    return checkpoint;
  }

  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).reverse();
  }

  compare(id1: string, id2: string): CompareResult {
    const cp1 = this.checkpoints.get(id1);
    const cp2 = this.checkpoints.get(id2);
    if (!cp1 || !cp2) {
      throw new Error('Checkpoint nicht gefunden');
    }

    const img1 = PNG.sync.read(Buffer.from(cp1.screenshotBase64, 'base64') as any);
    const img2 = PNG.sync.read(Buffer.from(cp2.screenshotBase64, 'base64') as any);

    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    const diff = new PNG({ width, height });
    const diffCount = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });

    const totalPixels = width * height;
    const diffPercent = totalPixels > 0 ? (diffCount / totalPixels) * 100 : 0;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasChanges = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (diff.data[idx] !== 0 || diff.data[idx + 1] !== 0 || diff.data[idx + 2] !== 0) {
          hasChanges = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const boundingBox = hasChanges
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null;

    return {
      compared: true,
      checkpoint1: { id: cp1.id, name: cp1.name, timestamp: cp1.timestamp },
      checkpoint2: { id: cp2.id, name: cp2.name, timestamp: cp2.timestamp },
      imageDimensions: { width, height },
      pixelDiff: { count: diffCount, percent: Math.round(diffPercent * 100) / 100 },
      boundingBox,
      screenshotIdentical: diffCount === 0,
      urlChanged: cp1.url !== cp2.url,
      titleChanged: cp1.title !== cp2.title,
      observationChanged: JSON.stringify(cp1.observation) !== JSON.stringify(cp2.observation),
    };
  }

  private createCheckpointId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
