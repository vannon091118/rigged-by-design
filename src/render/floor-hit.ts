/**
 * Ein Trefferpfad fuer Maus und Finger.
 *
 * Vorher entschied `floor-input` nach Array-Reihenfolge: das erste Moebel im
 * Snapshot gewann, auch wenn ein Gast davor stand, und ein Gast hinter der Wand
 * war trotzdem klickbar. Diese Datei beantwortet nur eine Frage — "was ist an
 * dieser Kachel gemeint" — und kennt weder Pixi noch React.
 */
import { wallOwnerTile } from './floor-math';

type HitKind = 'furniture' | 'guest' | 'crate' | 'stain' | 'mop';

/**
 * Bildschirmanker eines Treffers; die UI haengt ihre Karte daran. `worldX` und
 * `worldY` sind der unveraenderliche Weltpunkt in Kamera-Pixeln. Ohne ihn
 * muesste die Karte beim Schwenken am alten Klick kleben.
 */
export interface ScreenAnchor {
  readonly x: number;
  readonly y: number;
  readonly worldX?: number;
  readonly worldY?: number;
}

interface HitCell {
  readonly x: number;
  readonly y: number;
}

interface FloorHit {
  readonly kind: HitKind;
  readonly id: number;
  /** Fusslinie in Tiles; groesser heisst weiter vorne. */
  readonly depth: number;
  /** Fussanker des Objekts in Tiles, nicht der Klickpunkt. */
  readonly at: HitCell;
}

interface WallEdge {
  readonly axis: 'H' | 'V';
  readonly x: number;
  readonly y: number;
  readonly kind: string;
}

export interface HitView {
  readonly size: number;
  readonly furniture: readonly { readonly id: number; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly guests: readonly { readonly id: number; readonly position: HitCell }[];
  readonly crates?: readonly { readonly id: number; readonly x: number; readonly y: number }[];
  readonly stains: readonly { readonly id: number; readonly x: number; readonly y: number }[];
  readonly mops?: readonly { readonly id: number; readonly x: number; readonly y: number; readonly carriedBy: 'player' | null }[];
  readonly layout?: { readonly edges: readonly WallEdge[] };
}

/** Bei gleicher Fusslinie gewinnt die Figur vor der Kiste vor dem Moebel vor dem Fleck. */
const RANK: Readonly<Record<HitKind, number>> = { stain: 0, furniture: 1, mop: 2, crate: 3, guest: 4 };

type Candidate = FloorHit;

const keyOf = (x: number, y: number, size: number): number => y * size + x;

/** Alle Kacheln, die eine Wandkante besitzt; nur Wandkanten zaehlen. */
function wallCells(view: HitView): Set<number> {
  const cells = new Set<number>();
  for (const edge of view.layout?.edges ?? []) {
    if (edge.kind !== 'WALL') continue;
    const owner = wallOwnerTile(edge, view.size);
    cells.add(keyOf(owner.x, owner.y, view.size));
  }
  return cells;
}

/**
 * Sichtlinie zwischen Spieler und Ziel: liegt eine Wandkachel dazwischen, ist
 * das Ziel nicht gemeint. Benachbartes bleibt erlaubt, sonst waere der eigene
 * Tisch unklickbar, sobald er an einer Wand steht.
 */
export function sightBlocked(view: HitView, from: HitCell, to: HitCell): boolean {
  const walls = wallCells(view);
  if (walls.size === 0) return false;
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  if (steps <= 1) return false;
  for (let step = 1; step < steps; step += 1) {
    const share = step / steps;
    const x = Math.round(from.x + (to.x - from.x) * share);
    const y = Math.round(from.y + (to.y - from.y) * share);
    if (walls.has(keyOf(x, y, view.size))) return true;
  }
  return false;
}

/** Vorderstes Ziel: Tiefe, dann Rang, dann die kleinere ID. */
export function pickHit(candidates: readonly Candidate[]): FloorHit | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (!best) { best = candidate; continue; }
    if (candidate.depth !== best.depth) {
      if (candidate.depth > best.depth) best = candidate;
      continue;
    }
    if (RANK[candidate.kind] !== RANK[best.kind]) {
      if (RANK[candidate.kind] > RANK[best.kind]) best = candidate;
      continue;
    }
    if (candidate.id < best.id) best = candidate;
  }
  return best;
}

/**
 * Was ist an dieser Kachel gemeint? Maustaste und Finger landen hier beide;
 * es gibt keinen zweiten Pfad und damit keinen Doppel-Trigger. Der Rueckgabewert
 * traegt den Fussanker des Objekts, nicht die geklickte Pixelposition.
 */
export function resolveHit(view: HitView, cell: HitCell, from: HitCell): FloorHit | null {
  if (cell.x < 0 || cell.y < 0 || cell.x >= view.size || cell.y >= view.size) return null;
  const candidates: Candidate[] = [];
  for (const stain of view.stains) {
    if (Math.abs(stain.x - cell.x) <= 1 && Math.abs(stain.y - cell.y) <= 1) {
      candidates.push({
        kind: 'stain', id: stain.id, depth: stain.y + 1,
        at: { x: stain.x + 0.5, y: stain.y + 0.5 },
      });
    }
  }
  for (const mop of view.mops ?? []) {
    if (mop.carriedBy !== null) continue;
    if (mop.x === cell.x && mop.y === cell.y) {
      candidates.push({
        kind: 'mop', id: mop.id, depth: mop.y + 0.7,
        at: { x: mop.x + 0.5, y: mop.y + 0.5 },
      });
    }
  }
  for (const crate of view.crates ?? []) {
    if (crate.x === cell.x && crate.y === cell.y) {
      candidates.push({
        kind: 'crate', id: crate.id, depth: crate.y + 0.8,
        at: { x: crate.x + 0.5, y: crate.y + 0.5 },
      });
    }
  }
  for (const item of view.furniture) {
    if (cell.x >= item.x && cell.y >= item.y && cell.x < item.x + item.w && cell.y < item.y + item.h) {
      candidates.push({
        kind: 'furniture', id: item.id, depth: item.y + item.h,
        at: { x: item.x + item.w / 2, y: item.y + item.h },
      });
    }
  }
  for (const guest of view.guests) {
    if (Math.abs(guest.position.x - cell.x) + Math.abs(guest.position.y - cell.y) <= 1) {
      candidates.push({
        kind: 'guest', id: guest.id, depth: guest.position.y + 0.8,
        at: { x: guest.position.x + 0.5, y: guest.position.y + 0.5 },
      });
    }
  }
  return pickHit(candidates.filter((candidate) => !sightBlocked(view, from, candidate.at)));
}
