/** A* auf dem Tile-Grid. Deterministisch, 4 Richtungen, mit Blockern. */
import type { Furniture, Point, Zone } from './types';
import { zoneSignature, zoneWallTiles } from './walls';

function tileIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

/** Ein Muster, an dem sich der Nav-Cache wiedererkennt: Zahl, IDs und Positionen. */
function structureKey(furniture: readonly Furniture[]): string {
  let key = `${furniture.length}`;
  for (const item of furniture) {
    key += `|${item.id}:${item.x}:${item.y}:${item.w}:${item.h}`;
  }
  return key;
}

let cache: { size: number; key: string; tiles: Set<number> } | null = null;

/**
 * Belegte Tiles: Brettrand, Moebel und die aus den Zonen abgeleiteten Wand-Ringe
 * (dieselben Durchgaenge wie die Wand-Malerei, siehe walls.ts). Das Raster wird
 * pro Aufbau gecacht, weil Bewegungen pro Tick mehrfach danach fragen; jede
 * Bau- oder Zonenaenderung erzeugt einen neuen Schluessel.
 * Der zurueckgegebene Set ist schreibgeschuetzt zu behandeln.
 */
export function blockedTiles(size: number, furniture: readonly Furniture[], zones: readonly Zone[] = []): Set<number> {
  const zonesKey = zones.length > 0 ? zoneSignature(zones) : '-';
  const key = `${zonesKey}#${structureKey(furniture)}`;
  if (cache && cache.size === size && cache.key === key) return cache.tiles;
  const tiles = new Set<number>();
  for (let i = 0; i < size; i += 1) {
    tiles.add(tileIndex(size, i, 0));
    tiles.add(tileIndex(size, i, size - 1));
    tiles.add(tileIndex(size, 0, i));
    tiles.add(tileIndex(size, size - 1, i));
  }
  for (const item of furniture) {
    for (let y = item.y; y < item.y + item.h; y += 1) {
      for (let x = item.x; x < item.x + item.w; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) tiles.add(tileIndex(size, x, y));
      }
    }
  }
  for (const zone of zones) {
    for (const tile of zoneWallTiles(zone, zones, size)) tiles.add(tile);
  }
  cache = { size, key, tiles };
  return tiles;
}

export function isWalkable(size: number, blocked: Set<number>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size && !blocked.has(tileIndex(size, x, y));
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
export function findPath(size: number, blocked: Set<number>, start: Point, goal: Point): Point[] {
  if (!isWalkable(size, blocked, goal.x, goal.y) || !isWalkable(size, blocked, start.x, start.y)) return [];
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
      if (blocked.has(next)) continue;
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

/** Freies Tile vor einem Objekt; Reihenfolge unten, links, rechts, oben. */
export function approachPoint(size: number, blocked: Set<number>, item: Furniture): Point | null {
  const candidates: Point[] = [
    { x: item.x + Math.floor(item.w / 2), y: item.y + item.h },
    { x: item.x - 1, y: item.y + Math.floor(item.h / 2) },
    { x: item.x + item.w, y: item.y + Math.floor(item.h / 2) },
    { x: item.x + Math.floor(item.w / 2), y: item.y - 1 },
  ];
  return candidates.find((point) => isWalkable(size, blocked, point.x, point.y)) ?? null;
}

/** Ringe von innen nach aussen: jedes Tile wird pro Radius genau einmal geprueft, nicht je Quadrat. */
export function nearestWalkable(size: number, blocked: Set<number>, from: Point): Point | null {
  if (isWalkable(size, blocked, from.x, from.y)) return from;
  for (let radius = 1; radius < size; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const edgeRow = dy === -radius || dy === radius;
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!edgeRow && dx !== -radius && dx !== radius) continue;
        const x = from.x + dx;
        const y = from.y + dy;
        if (isWalkable(size, blocked, x, y)) return { x, y };
      }
    }
  }
  return null;
}
