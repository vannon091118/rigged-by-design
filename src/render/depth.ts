/**
 * Gemeinsamer Tiefenvertrag der Szene: sortiert wird ausschliesslich nach dem
 * Fuss-/Bodenanker, nie nach der Oberkante eines grossen Sprites. Bei gleichem
 * Anker entscheidet der Typ-Rang, danach die stabile ID (kleiner zuerst).
 */
import { Container } from 'pixi.js';

type DepthKind = 'prop' | 'furniture' | 'actor' | 'wall';

/** Rang bei gleichem Anker: Requisite, Moebel, Figur, Wand. */
const RANK: Readonly<Record<DepthKind, number>> = { prop: 0, furniture: 1, actor: 2, wall: 3 };
/** IDs bleiben klein; 0..999 reicht fuer Gaeste, Moebel und Kanten. */
const ID_SPAN = 1000;

/** Fussanker eines Footprints in Pixeln; `tileH` ist die Hoehe in Tiles. */
export function footAnchor(tileY: number, tileH: number, tile: number): number {
  return (tileY + tileH) * tile;
}

/** Ganzzahliger, deterministischer zIndex aus Anker, Typ und ID. */
export function depthFor(anchorY: number, kind: DepthKind, id: number): number {
  return Math.round(anchorY * 100) * 10_000 + RANK[kind] * ID_SPAN + (Math.abs(Math.trunc(id)) % ID_SPAN);
}

/**
 * Sortierbare Welt-Ebene. `set()` schreibt nur bei echter Aenderung; `flush()`
 * sortiert genau dann, wenn mindestens ein Anker oder eine ID gewandert ist.
 */
export class DepthStage {
  readonly root = new Container();
  #dirty = false;

  constructor() {
    this.root.sortableChildren = true;
  }

  set(child: Container, anchorY: number, kind: DepthKind, id: number): void {
    const z = depthFor(anchorY, kind, id);
    if (child.zIndex === z) return;
    child.zIndex = z;
    this.#dirty = true;
  }

  markDirty(): void {
    this.#dirty = true;
  }

  flush(): void {
    if (!this.#dirty) return;
    this.root.sortChildren();
    this.#dirty = false;
  }
}
