/**
 * Wand-Daten im Sim: aus den Zonen abgeleitete Blockierkacheln. Die Regeln
 * (Nachbargrundriss, Innentuere, Vordertuer) sind dieselben, nach denen
 * room-art.ts malt - eine Quelle, damit Malerei und Kollision nie auseinanderlaufen.
 */
import type { Zone } from './types';

/** Die sechs Felder, die Wandpolitik braucht; Zone erfuellt sie strukturell. */
interface WallZoneLike {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

type Side = 'top' | 'bottom' | 'left' | 'right';
type Span = readonly [number, number];

function touchingSpans(zone: WallZoneLike, others: readonly WallZoneLike[], side: Side): Span[] {
  const spans: Span[] = [];
  for (const other of others) {
    if (other.id === zone.id) continue;
    const touches = side === 'left' ? other.x + other.w === zone.x
      : side === 'right' ? zone.x + zone.w === other.x
        : side === 'top' ? other.y + other.h === zone.y : zone.y + zone.h === other.y;
    if (!touches) continue;
    const span: Span = side === 'left' || side === 'right'
      ? [Math.max(zone.y, other.y), Math.min(zone.y + zone.h, other.y + other.h)]
      : [Math.max(zone.x, other.x), Math.min(zone.x + zone.w, other.x + other.w)];
    if (span[1]! - span[0]! < 2) continue;
    spans.push(span);
  }
  return spans;
}

/**
 * Innentuer: zwei offene Kacheln in der Seitenmitte, wenn die Seite weder am
 * Brettrand liegt noch zu kurz ist. Ohne sie waere der Raum eine geschlossene Kiste.
 */
function doorSpan(zone: WallZoneLike, side: Side, size: number): Span | null {
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

/** Vordertuer: der Eingang bleibt links der Mitte zwei Kacheln offen. */
export function frontDoorSpan(zone: WallZoneLike, side: Side): Span | null {
  if (zone.kind !== 'ENTRANCE' || side !== 'left') return null;
  const mid = zone.y + Math.floor(zone.h / 2);
  return [Math.max(zone.y, mid - 1), Math.min(zone.y + zone.h, mid + 1)];
}

/** Alle Durchgaenge auf einer Seite; Malerei und Kollision lesen hier. */
export function openingsOn(zone: WallZoneLike, others: readonly WallZoneLike[], side: Side, size: number): Span[] {
  const list: Span[] = [...touchingSpans(zone, others, side)];
  const door = doorSpan(zone, side, size);
  if (door) list.push(door);
  const front = frontDoorSpan(zone, side);
  if (front) list.push(front);
  return list;
}

/**
 * Wandkacheln eines Zonenrings: Randzeile und -spalte werden geblockt, genau
 * die Kacheln in Offnungen bleiben frei. Eckkacheln zählen offen, sobald auf
 * irgendeiner Seite eine Offnung sie deckt.
 */
export function zoneWallTiles(zone: WallZoneLike, others: readonly WallZoneLike[], size: number): number[] {
  const right = zone.x + zone.w - 1;
  const bottom = zone.y + zone.h - 1;
  const inOpenings = (side: Side, value: number): boolean =>
    openingsOn(zone, others, side, size).some(([from, to]) => value >= from && value < to);
  const tiles: number[] = [];
  for (let x = zone.x; x <= right; x += 1) {
    if (!inOpenings('top', x)) tiles.push(zone.y * size + x);
    if (!inOpenings('bottom', x)) tiles.push(bottom * size + x);
  }
  for (let y = zone.y; y <= bottom; y += 1) {
    if (!inOpenings('left', y)) tiles.push(y * size + zone.x);
    if (!inOpenings('right', y)) tiles.push(y * size + right);
  }
  return tiles;
}

/** Vergleicht nur die Felder, die an der Wandpolitik haengen. */
export function zoneSignature(zones: readonly Zone[]): string {
  return zones.map((zone) => `${zone.id}:${zone.kind}:${zone.x}:${zone.y}:${zone.w}:${zone.h}`).join('.');
}
