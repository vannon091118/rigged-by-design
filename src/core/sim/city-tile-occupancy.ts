/**
 * @module city-tile-occupancy — ticklokale Kachelbelegung der Stadtbewohner
 *
 * Die Belegung ist kein gespeicherter Zustand: Sie wird aus den aktuellen
 * Positionen abgeleitet und waehrend eines Ticks fortgeschrieben. Nur laufende
 * Bewohner blockieren eine Kachel; stehende Bewohner sind kein Dauerhindernis
 * mitten auf dem Weg, werden aber beim Ankommen als Belegung erkannt.
 */
import type { CityResidentState } from './city-life-types';
import type { CitySceneState } from './city-scene';
import { cityNav } from './city-scene';
import { isWalkable } from './pathfinding';
import type { Point } from './types-model';

interface OccupancyResident {
  readonly npcId: string;
  readonly position: Point;
}

interface TileOccupancy {
  readonly occupants: Map<string, Set<string>>;
  readonly travelers: ReadonlySet<string>;
  readonly nextTiles: ReadonlyMap<string, Point>;
}

const tileKey = (point: Point): string => `${point.x},${point.y}`;

/** Baut die Belegung aus den Positionen und den bereits berechneten Folgeschritten. */
export function createOccupancy(
  residents: readonly OccupancyResident[],
  nextTiles: ReadonlyMap<string, Point>,
): TileOccupancy {
  const occupants = new Map<string, Set<string>>();
  for (const resident of residents) {
    const key = tileKey(resident.position);
    const ids = occupants.get(key) ?? new Set<string>();
    ids.add(resident.npcId);
    occupants.set(key, ids);
  }
  return { occupants, travelers: new Set(nextTiles.keys()), nextTiles };
}

/** Alle Bewohner auf der Zielkachel; der eigene Eintrag zaehlt nicht. */
function blockersAt(
  occupancy: TileOccupancy,
  residentId: string,
  point: Point,
): readonly string[] {
  return [...(occupancy.occupants.get(tileKey(point)) ?? [])]
    .filter((npcId) => npcId !== residentId);
}

function occupantCount(occupancy: TileOccupancy, point: Point): number {
  return occupancy.occupants.get(tileKey(point))?.size ?? 0;
}

interface StepResolution {
  readonly canMove: boolean;
  readonly push: { readonly npcId: string; readonly from: Point; readonly to: Point } | null;
}

/** Entscheidet einen Schritt gegen die Belegung; ein stehender Blocker weicht aus. */
export function resolveStep(
  occupancy: TileOccupancy, residentId: string, from: Point, to: Point, arrived: boolean,
): StepResolution {
  const blockers = blockersAt(occupancy, residentId, to);
  if (blockers.length === 0) return { canMove: true, push: null };
  const only = blockers.length === 1 ? blockers[0]! : null;
  if (only && !occupancy.travelers.has(only) && occupantCount(occupancy, from) === 1) {
    return { canMove: true, push: { npcId: only, from: to, to: from } };
  }
  if (!arrived && isSwap(occupancy, from, blockers)) return { canMove: true, push: null };
  return { canMove: false, push: null };
}

/**
 * Zwei stehende Bewohner duerfen nicht dieselbe Kachel halten. Der stabile
 * Listenplatz bleibt; nur Nachruecker ohne Weg weichen auf eine freie
 * Nachbarkachel aus. Laufende Bewohner bleiben unangetastet, ihre Kollision
 * loest der Tick selbst auf.
 */
export function separatePositions(
  residents: readonly CityResidentState[], city: CitySceneState, nextTiles: ReadonlyMap<string, Point>,
): CityResidentState[] {
  const nav = cityNav(city);
  const occupied = new Set(residents.map((resident) => tileKey(resident.position)));
  const placed = new Set<string>();
  const reservedNext = new Set([...nextTiles.values()].map(tileKey));
  return residents.map((resident) => {
    const key = tileKey(resident.position);
    if (!placed.has(key)) {
      placed.add(key);
      return resident;
    }
    if (resident.travel) {
      placed.add(key);
      return resident;
    }
    const free = [
      { x: resident.position.x + 1, y: resident.position.y },
      { x: resident.position.x, y: resident.position.y + 1 },
      { x: resident.position.x, y: resident.position.y - 1 },
      { x: resident.position.x - 1, y: resident.position.y },
    ].find((point) => {
      const target = tileKey(point);
      return isWalkable(nav, point.x, point.y) && !occupied.has(target) && !reservedNext.has(target);
    });
    if (!free) return resident;
    occupied.add(tileKey(free));
    placed.add(tileKey(free));
    return { ...resident, position: free };
  });
}

/**
 * Zwei Laufende duerfen tauschen, wenn jeder als naechstes die aktuelle Kachel
 * des anderen betritt. So loest sich eine Begegnung im engen Gang deterministisch.
 */
function isSwap(
  occupancy: TileOccupancy,
  from: Point,
  blockers: readonly string[],
): boolean {
  return blockers.length > 0 && blockers.every((npcId) => {
    const next = occupancy.nextTiles.get(npcId);
    return next?.x === from.x && next.y === from.y;
  });
}

/** Fuehrt den Ausweichschritt eines stehenden Blockers aus. */
export function applyPush(
  occupancy: TileOccupancy,
  push: { readonly npcId: string; readonly from: Point; readonly to: Point },
  residents: Map<string, CityResidentState>,
): void {
  const other = residents.get(push.npcId)!;
  moveOccupant(occupancy, push.from, push.to, other.npcId);
  residents.set(other.npcId, { ...other, position: push.to });
}

/** Schreibt einen Schritt fort; der alte Eintrag wird freigegeben. */
export function moveOccupant(
  occupancy: TileOccupancy,
  from: Point,
  to: Point,
  npcId: string,
): void {
  const fromKey = tileKey(from);
  const source = occupancy.occupants.get(fromKey);
  if (source) {
    source.delete(npcId);
    if (source.size === 0) occupancy.occupants.delete(fromKey);
  }
  const toKey = tileKey(to);
  const target = occupancy.occupants.get(toKey) ?? new Set<string>();
  target.add(npcId);
  occupancy.occupants.set(toKey, target);
}
