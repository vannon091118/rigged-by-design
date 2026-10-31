/** 30x30-Bereiche, Multi-Tile-Footprints und Zugangs-Tiles. Reine Grid-Politik, kein Rendering. */
import { blockedTiles, isWalkable } from './pathfinding';
import { REGION, type Furniture, type GameId, type TemplateId } from './types';

export { REGION };

/** Jede Vorlage schaltet ein Raster aus 30x30-Bereichen frei: klein 1, mittel 4, gross 9. */
const AREA_SIDE: Readonly<Record<TemplateId, number>> = { SMALL: 1, MEDIUM: 2, LARGE: 3 };

export interface Area {
  readonly id: string;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const AREA_CACHE: Partial<Record<TemplateId, readonly Area[]>> = {};

export function areasFor(template: TemplateId): readonly Area[] {
  const cached = AREA_CACHE[template];
  if (cached) return cached;
  const side = AREA_SIDE[template];
  const areas: Area[] = [];
  for (let row = 0; row < side; row += 1) {
    for (let col = 0; col < side; col += 1) {
      const index = row * side + col;
      areas.push({ id: `area-${index}`, index, x: col * REGION, y: row * REGION, w: REGION, h: REGION });
    }
  }
  AREA_CACHE[template] = areas;
  return areas;
}

export function areaAt(template: TemplateId, x: number, y: number): Area | null {
  const side = AREA_SIDE[template];
  const col = Math.floor(x / REGION);
  const row = Math.floor(y / REGION);
  if (col < 0 || row < 0 || col >= side || row >= side) return null;
  return areasFor(template)[row * side + col] ?? null;
}

interface Footprint {
  readonly w: number;
  readonly h: number;
  readonly seats: number;
}

/** Ein Spielgeraet ist immer genau so gross wie sein Footprint; Werte in Tiles. */
export const GAME_FOOTPRINT: Readonly<Record<GameId, Footprint>> = {
  SLOT: { w: 1, h: 1, seats: 1 },
  PLINKO: { w: 1, h: 1, seats: 1 },
  BLACKJACK: { w: 2, h: 2, seats: 4 },
  POKER: { w: 2, h: 2, seats: 4 },
  VIDEO_POKER: { w: 1, h: 1, seats: 1 },
  ROULETTE: { w: 3, h: 2, seats: 6 },
  SHELL: { w: 1, h: 1, seats: 1 },
  DICE: { w: 2, h: 1, seats: 2 },
};

/** Servicepunkte, die jede Vorlage mitbringt. */
export const SERVICE_FOOTPRINT: Readonly<Record<'EXCHANGE' | 'BAR' | 'TOILET' | 'STORAGE', Footprint>> = {
  EXCHANGE: { w: 2, h: 2, seats: 1 },
  BAR: { w: 4, h: 2, seats: 4 },
  TOILET: { w: 2, h: 2, seats: 2 },
  STORAGE: { w: 3, h: 3, seats: 0 },
};

export function accessPoint(
  size: number,
  furniture: readonly Furniture[],
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number } | null {
  const blocked = blockedTiles(size, furniture);
  const candidates = [
    { x: x + Math.floor(w / 2), y: y + h },
    { x: x - 1, y: y + Math.floor(h / 2) },
    { x: x + w, y: y + Math.floor(h / 2) },
    { x: x + Math.floor(w / 2), y: y - 1 },
  ];
  return candidates.find((point) => isWalkable(size, blocked, point.x, point.y)) ?? null;
}

const inside = (point: { x: number; y: number }, x: number, y: number, w: number, h: number): boolean =>
  point.x >= x && point.x < x + w && point.y >= y && point.y < y + h;

/** Volle Tile-Flaeche, keine Ueberlappung, mindestens ein freies Zugangs-Tile bei Sitzplaetzen. */
export function canPlaceAt(
  size: number,
  furniture: readonly Furniture[],
  blockers: readonly { x: number; y: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
  needsAccess = true,
): boolean {
  if (x < 1 || y < 1 || x + w > size - 1 || y + h > size - 1) return false;
  if (blockers.some((point) => inside(point, x, y, w, h))) return false;
  if (furniture.some((item) => x < item.x + item.w && x + w > item.x && y < item.y + item.h && y + h > item.y)) {
    return false;
  }
  return !needsAccess || accessPoint(size, furniture, x, y, w, h) !== null;
}
