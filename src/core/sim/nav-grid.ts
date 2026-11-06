/** Navigationsraster: belegte Tiles, Wandkanten und ein Cache fuer beides. */
import { edgeKey } from './layout-edges';
import type { LayoutState } from './layout-types';
import type { Furniture, Point } from './types';

export interface NavGrid {
  readonly size: number;
  /** Tiles, die durch Moebel belegt sind. Der Rand ist keine Tile-Sperre mehr. */
  readonly blocked: ReadonlySet<number>;
  /** Unpassierbare Kanten (nur WALL); Tueren und Durchgaenge fehlen hier. */
  readonly walls: ReadonlySet<string>;
}

const EMPTY_WALLS: ReadonlySet<string> = new Set<string>();

export const tileIndex = (size: number, x: number, y: number): number => y * size + x;

/** Ein Muster, an dem sich der Nav-Cache wiedererkennt: Zahl, IDs und Positionen. */
function structureKey(furniture: readonly Furniture[]): string {
  let key = `${furniture.length}`;
  for (const item of furniture) key += `|${item.id}:${item.x}:${item.y}:${item.w}:${item.h}`;
  return key;
}

let tilesCache: { size: number; key: string; tiles: ReadonlySet<number> } | null = null;

/**
 * Belegte Tiles: nur Moebel. Die Aussenwand ist eine Kante, kein gesperrtes
 * Tile; damit kann ein Gast die Randkachel betreten, aber nicht hinaus.
 */
export function blockedTiles(size: number, furniture: readonly Furniture[]): ReadonlySet<number> {
  const key = structureKey(furniture);
  if (tilesCache && tilesCache.size === size && tilesCache.key === key) return tilesCache.tiles;
  const tiles = new Set<number>();
  for (const item of furniture) {
    for (let y = item.y; y < item.y + item.h; y += 1) {
      for (let x = item.x; x < item.x + item.w; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) tiles.add(tileIndex(size, x, y));
      }
    }
  }
  tilesCache = { size, key, tiles };
  return tiles;
}

let wallCache: { layout: LayoutState; walls: ReadonlySet<string> } | null = null;

/** Nur Waende blockieren einen Uebergang; Tueren und Durchgaenge bleiben offen. */
function layoutWalls(layout: LayoutState): ReadonlySet<string> {
  if (wallCache && wallCache.layout === layout) return wallCache.walls;
  const walls = new Set<string>();
  for (const edge of layout.edges) if (edge.kind === 'WALL') walls.add(edgeKey(edge.axis, edge.x, edge.y));
  wallCache = { layout, walls };
  return walls;
}

let gridCache: { size: number; key: string; layout: LayoutState | null; nav: NavGrid } | null = null;

/**
 * Ein Raster je Aufbau. Ein Layout ist unveraenderlich und wird als Ganzes
 * ersetzt; seine Identitaet erkennt deshalb jede relevante Layout-Aenderung,
 * ohne die Kanten erneut zu vergleichen.
 */
export function navGrid(size: number, furniture: readonly Furniture[], layout?: LayoutState | null): NavGrid {
  const key = structureKey(furniture);
  if (gridCache && gridCache.size === size && gridCache.key === key
    && gridCache.layout === (layout ?? null)) return gridCache.nav;
  const nav: NavGrid = {
    size,
    blocked: blockedTiles(size, furniture),
    walls: layout ? layoutWalls(layout) : EMPTY_WALLS,
  };
  gridCache = { size, key, layout: layout ?? null, nav };
  return nav;
}

/** Ein Schritt ist nur ueber eine offene Kante erlaubt; Diagonalen gibt es nicht. */
export function stepOpen(nav: NavGrid, from: Point, to: Point): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  if (nav.walls.size === 0) return true;
  const key = dx !== 0
    ? edgeKey('V', Math.max(from.x, to.x), from.y)
    : edgeKey('H', from.x, Math.max(from.y, to.y));
  return !nav.walls.has(key);
}

/** Beide anliegenden Tiles einer Tuer oder eines Durchgangs, soweit im Raster. */
export function layoutDoorTiles(layout: LayoutState): Point[] {
  const seen = new Set<number>();
  const tiles: Point[] = [];
  for (const edge of layout.edges) {
    if (edge.kind === 'WALL') continue;
    const pair: Point[] = edge.axis === 'H'
      ? [{ x: edge.x, y: edge.y - 1 }, { x: edge.x, y: edge.y }]
      : [{ x: edge.x - 1, y: edge.y }, { x: edge.x, y: edge.y }];
    for (const point of pair) {
      if (point.x < 0 || point.y < 0 || point.x >= layout.size || point.y >= layout.size) continue;
      const key = tileIndex(layout.size, point.x, point.y);
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(point);
    }
  }
  return tiles.sort((left, right) => left.y - right.y || left.x - right.x);
}

/** Zusaetzlich belegte Tiles (Vorschau einer Platzierung) ohne den Cache zu stoeren. */
export function withBlocked(nav: NavGrid, tiles: Iterable<number>): NavGrid {
  const blocked = new Set(nav.blocked);
  for (const tile of tiles) blocked.add(tile);
  return { size: nav.size, blocked, walls: nav.walls };
}
