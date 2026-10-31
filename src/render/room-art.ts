/**
 * Architektur: jede Zone bekommt Waende mit Lichtkante, Sockel, Ecken und
 * Durchgaengen zu ihren Nachbarn. Alles statisch, damit die Chunk-Caches
 * weiter nur bei Strukturaenderungen neu backen.
 */
import type { Graphics } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { CARPETS } from '../core/sim/types';
import type { GameView } from '../store/types';
import { INK, LIGHT, materialFor, type FloorMaterial } from './art-tokens';
import { drawSurface, drawWalkway } from './floor-surface';

interface Rect { x: number; y: number; w: number; h: number }
interface ZoneLike { id: string; kind: string; x: number; y: number; w: number; h: number; color: number }
type Side = 'top' | 'bottom' | 'left' | 'right';

const WALL = 6;
const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right'];

/** Durchgang zwischen zwei Zonen: die Wand wird dort unterbrochen, der Boden laeuft weiter. */
function sharedSpans(zone: ZoneLike, others: readonly ZoneLike[], side: Side): [number, number][] {
  const spans: [number, number][] = [];
  for (const other of others) {
    if (other.id === zone.id) continue;
    const touching = side === 'left' ? other.x + other.w === zone.x
      : side === 'right' ? zone.x + zone.w === other.x
        : side === 'top' ? other.y + other.h === zone.y : zone.y + zone.h === other.y;
    if (!touching) continue;
    const a = side === 'left' || side === 'right' ? [Math.max(zone.y, other.y), Math.min(zone.y + zone.h, other.y + other.h)]
      : [Math.max(zone.x, other.x), Math.min(zone.x + zone.w, other.x + other.w)];
    if (a[1]! - a[0]! < 2) continue;
    spans.push([a[0]!, a[1]!]);
  }
  return spans;
}

/** Eine Wand: Koerper, Lichtkante zur Zone, Schatten in den Raum und Sockelstreifen. */
function drawWall(g: Graphics, zone: ZoneLike, side: Side, span: [number, number], mat: FloorMaterial, tile: number): void {
  const vertical = side === 'left' || side === 'right';
  const from = span[0] * tile;
  const size = (span[1] - span[0]) * tile;
  if (vertical) {
    const x = side === 'left' ? zone.x * tile : (zone.x + zone.w) * tile - WALL;
    const lightEdge = side === 'left' ? x + WALL - 1 : x;
    g.rect(x, from, WALL, size).fill({ color: INK, alpha: 0.94 });
    g.rect(lightEdge, from, 1, size).fill({ color: mat.light, alpha: 0.24 });
    g.rect(side === 'left' ? x + WALL : x - 2, from, 2, size).fill({ color: 0x000000, alpha: 0.32 });
    g.rect(side === 'left' ? x : x + WALL - 2, from, 2, size).fill({ color: mat.accent, alpha: 0.12 });
  } else {
    const y = side === 'top' ? zone.y * tile : (zone.y + zone.h) * tile - WALL;
    const lightEdge = side === 'top' ? y + WALL - 1 : y;
    g.rect(from, y, size, WALL).fill({ color: INK, alpha: 0.94 });
    g.rect(from, lightEdge, size, 1).fill({ color: mat.light, alpha: 0.24 });
    g.rect(from, side === 'top' ? y + WALL : y - 2, size, 2).fill({ color: 0x000000, alpha: 0.32 });
    g.rect(from, side === 'top' ? y : y + WALL - 2, size, 2).fill({ color: mat.accent, alpha: 0.12 });
  }
}

/**
 * Tueren: wo zwei Zonen aneinanderstossen, ist der Durchgang offen; sonst bekommt jede
 * Innenwand eine Tuer zur Laufzone. Ohne sie waeren die Raeume geschlossene Kisten.
 */
function doorSpan(zone: ZoneLike, side: Side, size: number): [number, number] | null {
  if (zone.kind === 'ENTRANCE' && side === 'left') return null;
  const exterior = side === 'left' ? zone.x === 0
    : side === 'right' ? zone.x + zone.w >= size
      : side === 'top' ? zone.y === 0 : zone.y + zone.h >= size;
  if (exterior) return null;
  const from = side === 'left' || side === 'right' ? zone.y : zone.x;
  const length = side === 'left' || side === 'right' ? zone.h : zone.w;
  if (length < 4) return null;
  const start = from + Math.floor((length - 2) / 2);
  return [start, start + 2];
}

/** Eckpfeiler: ohne sie treffen sich zwei Waende nur mit einer Luecke. */
function drawCorners(g: Graphics, zone: ZoneLike, tile: number): void {
  const left = zone.x * tile;
  const top = zone.y * tile;
  const right = (zone.x + zone.w) * tile - WALL;
  const bottom = (zone.y + zone.h) * tile - WALL;
  for (const [cx, cy] of [[left, top], [right, top], [left, bottom], [right, bottom]]) {
    g.rect(cx!, cy!, WALL, WALL).fill({ color: INK, alpha: 0.94 });
  }
}

/** Schwelle im Durchgang: Bodenmaterial laeuft durch, zwei Kanten markieren die Tuer. */
function drawThresholds(g: Graphics, zone: ZoneLike, openings: readonly [number, number][], side: Side, mat: FloorMaterial, tile: number): void {
  {
    for (const span of openings) {
      const vertical = side === 'left' || side === 'right';
      const from = span[0] * tile;
      const size = (span[1] - span[0]) * tile;
      if (vertical) {
        const x = side === 'left' ? zone.x * tile : (zone.x + zone.w) * tile - WALL;
        g.rect(x, from, WALL, size).fill({ color: mat.base, alpha: 0.97 });
        g.rect(side === 'left' ? x + WALL - 2 : x, from, 2, size).fill({ color: 0x000000, alpha: 0.24 });
        g.rect(side === 'left' ? x : x + WALL - 1, from, 1, size).fill({ color: mat.accent, alpha: 0.2 });
      } else {
        const y = side === 'top' ? zone.y * tile : (zone.y + zone.h) * tile - WALL;
        g.rect(from, y, size, WALL).fill({ color: mat.base, alpha: 0.97 });
        g.rect(from, side === 'top' ? y + WALL - 2 : y, size, 2).fill({ color: 0x000000, alpha: 0.24 });
        g.rect(from, side === 'top' ? y : y + WALL - 1, size, 1).fill({ color: mat.accent, alpha: 0.2 });
      }
    }
  }
}

/** Eingang: Matte, zwei Pfosten und ein heller Durchgang an der linken Wand. */
function drawGate(g: Graphics, zone: ZoneLike, tile: number): void {
  const midY = (zone.y + zone.h / 2) * tile;
  const x = zone.x * tile;
  const mat = materialFor('ENTRANCE');
  g.rect(x, midY - tile, WALL, tile * 2).fill({ color: mat.light, alpha: 0.16 });
  g.rect(x + WALL - 2, midY - tile, 2, tile * 2).fill({ color: LIGHT.neon, alpha: 0.45 });
  g.roundRect(x + WALL, midY - tile * 0.7, tile * 3, tile * 1.4, 4)
    .fill({ color: INK, alpha: 0.4 })
    .stroke({ width: 1, color: mat.accent, alpha: 0.45 });
  for (const offset of [-tile * 1.5, tile * 1.5]) g.rect(x + WALL, midY + offset, 4, 4).fill({ color: mat.accent, alpha: 0.5 });
}

function drawZoneFloor(g: Graphics, zone: ZoneLike, others: readonly ZoneLike[], area: Area, tile: number, size: number): void {
  const ix = Math.max(zone.x, area.x);
  const iy = Math.max(zone.y, area.y);
  const ex = Math.min(zone.x + zone.w, area.x + area.w);
  const ey = Math.min(zone.y + zone.h, area.y + area.h);
  if (ex <= ix || ey <= iy) return;
  // Wandbreite nur an echten Zonenkanten abziehen; an Chunk-Grenzen 2 px ueberlappen,
  // damit die Kante der Cache-Textur keine Naht in den Boden zeichnet.
  const left = ix === zone.x ? WALL : -2;
  const top = iy === zone.y ? WALL : -2;
  const right = ex === zone.x + zone.w ? WALL : -2;
  const bottom = ey === zone.y + zone.h ? WALL : -2;
  const rect: Rect = {
    x: ix * tile + left,
    y: iy * tile + top,
    w: (ex - ix) * tile - left - right,
    h: (ey - iy) * tile - top - bottom,
  };
  if (rect.w <= 0 || rect.h <= 0) return;
  const mat = materialFor(zone.kind);
  drawSurface(g, mat, rect, tile, {
    top: iy === zone.y, bottom: ey === zone.y + zone.h,
    left: ix === zone.x, right: ex === zone.x + zone.w,
  });
  for (const side of SIDES) {
    const door = doorSpan(zone, side, size);
    const spans = [...sharedSpans(zone, others, side), ...(door ? [door] : [])].sort((a, b) => a[0] - b[0]);
    const whole: [number, number] = side === 'left' || side === 'right' ? [iy, ey] : [ix, ex];
    const openings: [number, number][] = [];
    let cursor = whole[0];
    for (const span of spans) {
      const clipped: [number, number] = [Math.max(span[0], whole[0]), Math.min(span[1], whole[1])];
      if (clipped[1] <= clipped[0]) continue;
      if (clipped[0] > cursor) drawWall(g, zone, side, [cursor, clipped[0]], mat, tile);
      openings.push(clipped);
      cursor = Math.max(cursor, clipped[1]);
    }
    if (cursor < whole[1]) drawWall(g, zone, side, [cursor, whole[1]], mat, tile);
    drawThresholds(g, zone, openings, side, mat, tile);
  }
  drawCorners(g, zone, tile);
  if (zone.kind === 'ENTRANCE') drawGate(g, zone, tile);
}

export function drawRegionFloor(g: Graphics, view: GameView, area: Area, tile: number): void {
  const carpet = CARPETS[view.carpet] ?? CARPETS.VIOLET;
  const ox = area.x * tile;
  const oy = area.y * tile;
  drawWalkway(g, carpet.color, { x: ox, y: oy, w: area.w * tile, h: area.h * tile }, tile);
  const zones = view.zones as readonly ZoneLike[];
  for (const zone of zones) drawZoneFloor(g, zone, zones, area, tile, view.size);
  if (area.x === 0 && area.y === 0) {
    const size = view.size * tile;
    g.rect(0, 0, size, size).stroke({ width: 8, color: INK });
    g.rect(4, 4, size - 8, size - 8).stroke({ width: 1, color: 0x4a3a66, alpha: 0.6 });
  }
}

export function drawRegionDirt(g: Graphics, view: GameView, area: Area, tile: number): void {
  for (const index of view.dirtyTiles) {
    const x = index % view.size;
    const y = Math.floor(index / view.size);
    if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) continue;
    const cx = x * tile + tile / 2;
    const cy = y * tile + tile / 2;
    g.ellipse(cx, cy, 8, 4.5).fill({ color: 0x45311d, alpha: 0.62 });
    g.ellipse(cx + 1, cy + 1, 4.5, 2.2).fill({ color: 0x2a1c10, alpha: 0.55 });
    g.circle(cx + 5, cy - 3, 2.6).fill({ color: 0x35241a, alpha: 0.7 });
    g.circle(cx - 4, cy + 2, 1.8).fill({ color: 0x35241a, alpha: 0.55 });
  }
}
