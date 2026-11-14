/**
 * @module city-tile-occupancy — ticklokale Kachelbelegung der Stadtbewohner
 *
 * Die Belegung ist kein gespeicherter Zustand: Sie wird aus den aktuellen
 * Positionen abgeleitet und waehrend eines Ticks fortgeschrieben. Nur laufende
 * Bewohner blockieren eine Kachel; stehende Bewohner sind kein Dauerhindernis
 * mitten auf dem Weg, werden aber beim Ankommen als Belegung erkannt.
 */
import type { Point } from './types-model';

export interface OccupancyResident {
  readonly npcId: string;
  readonly position: Point;
}

export interface TileOccupancy {
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

/** Laufende Bewohner auf der Zielkachel; der eigene Eintrag zaehlt nicht. */
export function blockersAt(
  occupancy: TileOccupancy,
  residentId: string,
  point: Point,
): readonly string[] {
  return [...(occupancy.occupants.get(tileKey(point)) ?? [])]
    .filter((npcId) => npcId !== residentId && occupancy.travelers.has(npcId));
}

/**
 * Zwei Laufende duerfen tauschen, wenn jeder als naechstes die aktuelle Kachel
 * des anderen betritt. So loest sich eine Begegnung im engen Gang deterministisch.
 */
export function isSwap(
  occupancy: TileOccupancy,
  from: Point,
  blockers: readonly string[],
): boolean {
  return blockers.length > 0 && blockers.every((npcId) => {
    const next = occupancy.nextTiles.get(npcId);
    return next?.x === from.x && next.y === from.y;
  });
}

export function isOccupied(occupancy: TileOccupancy, point: Point): boolean {
  return (occupancy.occupants.get(tileKey(point))?.size ?? 0) > 0;
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
