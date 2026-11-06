/** Editor-Auswahl als reine Pixi-Darstellung: eine Zelle und optional ihre Kante. */
import { Container, Graphics } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { EdgeAxis } from '../core/sim/layout-types';

export interface EditorCursor {
  readonly x: number;
  readonly y: number;
  readonly axis: EdgeAxis;
  readonly mode: 'FLOOR' | 'EDGE';
}

const CURSOR = 0x00ffcc;
const EDGE = 0xffd166;

export class EditorOverlay {
  readonly root = new Container();
  readonly #graphics = new Graphics();

  constructor() {
    this.root.addChild(this.#graphics);
    this.root.eventMode = 'none';
    this.root.visible = false;
  }

  set(cursor: EditorCursor | null): void {
    this.#graphics.clear();
    if (!cursor) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    const x = cursor.x * TILE;
    const y = cursor.y * TILE;
    this.#graphics
      .rect(x, y, TILE, TILE)
      .fill({ color: CURSOR, alpha: 0.12 })
      .stroke({ width: 1, color: CURSOR, alpha: 0.72 });
    if (cursor.mode !== 'EDGE') return;
    if (cursor.axis === 'H') {
      this.#graphics.rect(x, y - 1.5, TILE, 3).fill({ color: EDGE, alpha: 0.92 });
    } else {
      this.#graphics.rect(x - 1.5, y, 3, TILE).fill({ color: EDGE, alpha: 0.92 });
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
