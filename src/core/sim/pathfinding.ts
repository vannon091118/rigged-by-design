/** A* auf dem Tile-Grid. Deterministisch, 4 Richtungen, mit Blockern und Wandkanten. */
import { stepOpen, tileIndex, type NavGrid } from './nav-grid';
import type { Furniture, Point } from './types';

export { blockedTiles } from './nav-grid';

/** Ein Tile ist betretbar, wenn es im Raster liegt und kein Moebel traegt. */
export function isWalkable(nav: NavGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < nav.size && y < nav.size && !nav.blocked.has(tileIndex(nav.size, x, y));
}

/** Der Zugang muss frei UND ueber eine offene Kante mit dem Objekt verbunden sein. */
function openToFootprint(nav: NavGrid, point: Point, x: number, y: number, w: number, h: number): boolean {
  for (let ty = y; ty < y + h; ty += 1) {
    for (let tx = x; tx < x + w; tx += 1) if (stepOpen(nav, point, { x: tx, y: ty })) return true;
  }
  return false;
}

const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** Binaerer Min-Heap auf Tile-Indizes; Schluessel liegt in fScore. Kein Sortieren, keine String-Keys. */
class TileHeap {
  readonly #items: Int32Array;
  readonly #f: Int32Array;
  #length = 0;

  constructor(capacity: number, f: Int32Array) {
    this.#items = new Int32Array(capacity);
    this.#f = f;
  }

  get size(): number {
    return this.#length;
  }

  push(node: number): void {
    const items = this.#items;
    let index = this.#length;
    this.#length = index + 1;
    items[index] = node;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#f[items[parent]!]! <= this.#f[items[index]!]!) break;
      const swap = items[parent]!;
      items[parent] = items[index]!;
      items[index] = swap;
      index = parent;
    }
  }

  pop(): number {
    const items = this.#items;
    const top = items[0]!;
    this.#length -= 1;
    if (this.#length === 0) return top;
    items[0] = items[this.#length]!;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < this.#length && this.#f[items[left]!]! < this.#f[items[best]!]!) best = left;
      if (right < this.#length && this.#f[items[right]!]! < this.#f[items[best]!]!) best = right;
      if (best === index) break;
      const swap = items[best]!;
      items[best] = items[index]!;
      items[index] = swap;
      index = best;
    }
    return top;
  }
}

/** Gibt den Weg inklusive Ziel zurueck; [] wenn unerreichbar. */
export function findPath(nav: NavGrid, start: Point, goal: Point): Point[] {
  const size = nav.size;
  if (!isWalkable(nav, goal.x, goal.y) || !isWalkable(nav, start.x, start.y)) return [];
  const total = size * size;
  const startIndex = tileIndex(size, start.x, start.y);
  const goalIndex = tileIndex(size, goal.x, goal.y);
  if (startIndex === goalIndex) return [{ x: goal.x, y: goal.y }];

  const gScore = new Int32Array(total).fill(-1);
  const cameFrom = new Int32Array(total).fill(-1);
  const fScore = new Int32Array(total);
  // Vier Nachbarn je Tile, mit erneutem Einfuegen bei kleinerem g: grosszuegig dimensioniert.
  const heap = new TileHeap(total * 4 + 8, fScore);
  const settled = new Uint8Array(total);

  gScore[startIndex] = 0;
  fScore[startIndex] = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y);
  heap.push(startIndex);

  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goalIndex) break;
    if (settled[current] === 1) continue;
    settled[current] = 1;
    const cx = current % size;
    const cy = (current - cx) / size;
    const nextG = gScore[current]! + 1;
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const next = ny * size + nx;
      if (nav.blocked.has(next)) continue;
      if (!stepOpen(nav, { x: cx, y: cy }, { x: nx, y: ny })) continue;
      if (gScore[next] !== -1 && gScore[next]! <= nextG) continue;
      gScore[next] = nextG;
      cameFrom[next] = current;
      fScore[next] = nextG + Math.abs(nx - goal.x) + Math.abs(ny - goal.y);
      heap.push(next);
    }
  }

  if (cameFrom[goalIndex] === -1) return [];
  // Weg inklusive Start, wie ihn Bewegung und Tests erwarten.
  const path: Point[] = [];
  let cursor = goalIndex;
  while (cursor !== -1) {
    const x = cursor % size;
    path.push({ x, y: (cursor - x) / size });
    if (cursor === startIndex) break;
    cursor = cameFrom[cursor]!;
  }
  return path.reverse();
}

/**
 * Alle freien Zugaenge eines Footprints, deterministisch geordnet:
 * unten links nach rechts, rechts oben nach unten, oben rechts nach links,
 * links unten nach oben. Jeder Punkt liegt frei und teilt eine offene Kante
 * mit dem Objekt.
 */
export function accessPointsFor(nav: NavGrid, x: number, y: number, w: number, h: number): Point[] {
  const candidates: Point[] = [];
  for (let px = x; px < x + w; px += 1) candidates.push({ x: px, y: y + h });
  for (let py = y; py < y + h; py += 1) candidates.push({ x: x + w, y: py });
  for (let px = x + w - 1; px >= x; px -= 1) candidates.push({ x: px, y: y - 1 });
  for (let py = y + h - 1; py >= y; py -= 1) candidates.push({ x: x - 1, y: py });
  const seen = new Set<number>();
  return candidates.filter((point) => {
    if (!isWalkable(nav, point.x, point.y)) return false;
    const key = tileIndex(nav.size, point.x, point.y);
    if (seen.has(key)) return false;
    if (!openToFootprint(nav, point, x, y, w, h)) return false;
    seen.add(key);
    return true;
  });
}

export function accessPoints(nav: NavGrid, item: Furniture): Point[] {
  return accessPointsFor(nav, item.x, item.y, item.w, item.h);
}

/**
 * Bisheriger sicherer Fallback: ein Zugang vor dem Objekt, Reihenfolge unten,
 * links, rechts, oben. Bleibt fuer Aufrufer, die nur einen Punkt brauchen.
 */
export function approachPoint(nav: NavGrid, item: Furniture): Point | null {
  const candidates: Point[] = [
    { x: item.x + Math.floor(item.w / 2), y: item.y + item.h },
    { x: item.x - 1, y: item.y + Math.floor(item.h / 2) },
    { x: item.x + item.w, y: item.y + Math.floor(item.h / 2) },
    { x: item.x + Math.floor(item.w / 2), y: item.y - 1 },
  ];
  const point = candidates.find((entry) => isWalkable(nav, entry.x, entry.y)
    && openToFootprint(nav, entry, item.x, item.y, item.w, item.h));
  return point ?? null;
}

/** Ringe von innen nach aussen: jedes Tile wird pro Radius genau einmal geprueft, nicht je Quadrat. */
export function nearestWalkable(nav: NavGrid, from: Point): Point | null {
  if (isWalkable(nav, from.x, from.y)) return from;
  for (let radius = 1; radius < nav.size; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const edgeRow = dy === -radius || dy === radius;
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!edgeRow && dx !== -radius && dx !== radius) continue;
        const x = from.x + dx;
        const y = from.y + dy;
        if (isWalkable(nav, x, y)) return { x, y };
      }
    }
  }
  return null;
}
