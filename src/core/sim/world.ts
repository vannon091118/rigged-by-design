/** Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. */
import { canPlaceAt } from './grid-zones';
import { blockedTiles, approachPoint, findPath, isWalkable } from './pathfinding';
import type { Furniture, Guest, Point, WorldState, Zone } from './types';

export function zoneById(world: WorldState, id: string): Zone | null {
  return world.zones.find((zone) => zone.id === id) ?? null;
}

export function furnitureById(world: WorldState, id: number): Furniture | null {
  return world.furniture.find((item) => item.id === id) ?? null;
}

export function freeSeat(item: Furniture): boolean {
  return item.seats > item.occupants.length;
}

/** Spielplätze im Haus: eine Servicegröße, keine Sperre für neue Gäste. */
export function seatCount(world: WorldState): number {
  return world.furniture.reduce((sum, item) => sum + (item.gameId ? item.seats : 0), 0);
}

export function reserveSeat(world: WorldState, itemId: number, guestId: number): boolean {
  const item = furnitureById(world, itemId);
  if (!item || item.seats <= item.occupants.length || item.occupants.includes(guestId)) return false;
  item.occupants.push(guestId);
  return true;
}

export function releaseSeat(world: WorldState, itemId: number, guestId: number): void {
  const item = furnitureById(world, itemId);
  if (item) item.occupants = item.occupants.filter((id) => id !== guestId);
}

export function interactionPoint(world: WorldState, item: Furniture): Point | null {
  return approachPoint(world.size, blockedTiles(world.size, world.furniture), item);
}

/** Jeder Sitz bekommt ein eigenes Zugaengliches Tile; sonst stehen alle Gaeste auf demselben Punkt. */
export function seatPoint(world: WorldState, item: Furniture, seat: number): Point | null {
  const blocked = blockedTiles(world.size, world.furniture);
  const candidates: Point[] = [];
  for (let x = item.x; x < item.x + item.w; x += 1) candidates.push({ x, y: item.y + item.h });
  for (let y = item.y; y < item.y + item.h; y += 1) candidates.push({ x: item.x + item.w, y });
  for (let x = item.x + item.w - 1; x >= item.x; x -= 1) candidates.push({ x, y: item.y - 1 });
  for (let y = item.y + item.h - 1; y >= item.y; y -= 1) candidates.push({ x: item.x - 1, y });
  const free = candidates.filter((point) => isWalkable(world.size, blocked, point.x, point.y));
  return free[Math.abs(seat) % free.length] ?? approachPoint(world.size, blocked, item);
}

export function pathTo(world: WorldState, from: Point, to: Point): Point[] {
  return findPath(world.size, guestBlocked(world), from, to);
}

/** Tuertile: liegt vor dem Eingang auf dem Aussenstreifen, nie im Gebaeude. */
export function doorPoint(world: WorldState): Point {
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0]!;
  return {
    x: Math.max(0, entrance.x - 1),
    y: entrance.y + Math.floor(entrance.h / 2),
  };
}

/**
 * Aussenstreifen vor der Tuer: die Tuer und je ein Tile weiter draussen nach
 * oben und unten, damit nicht alle Ankoemmlinge auf derselben Kachel stehen.
 */
const APRON = 4;

function entranceApron(world: WorldState): Point[] {
  const door = doorPoint(world);
  const spots: Point[] = [{ ...door }];
  for (let step = 1; step <= APRON; step += 1) {
    spots.push({ x: door.x, y: door.y + step }, { x: door.x, y: door.y - step });
  }
  return spots;
}

/** Begehbare Tiles fuer Gaeste: die Aussenwand ist blockiert, nur der Eingangsstreifen ist offen. */
export function guestBlocked(world: WorldState): Set<number> {
  const blocked = new Set(blockedTiles(world.size, world.furniture));
  for (const spot of entranceApron(world)) blocked.delete(spot.y * world.size + spot.x);
  return blocked;
}

/** Gaeste erscheinen und verschwinden draussen vor der Tuer, gehen von dort durch den Eingang. */
export function spawnPoint(world: WorldState): Point {
  return doorPoint(world);
}

/**
 * Eigener Aussenplatz je Gast: niemand spawnt auf dem Tile eines anderen.
 * Erst der Streifen draussen vor der Tuer, bei Andrang die Eingangshalle.
 */
export function entranceSpot(world: WorldState, guestId = 0): Point {
  const door = doorPoint(world);
  const taken = new Set(world.guests.map((guest) => guest.position.y * world.size + guest.position.x));
  for (const spot of entranceApron(world)) {
    if (spot.x < 0 || spot.y < 0 || spot.x >= world.size || spot.y >= world.size) continue;
    if (taken.has(spot.y * world.size + spot.x)) continue;
    return spot;
  }
  const blocked = blockedTiles(world.size, world.furniture);
  const hall = world.zones.find((zone) => zone.kind === 'ENTRANCE');
  if (hall) {
    for (let y = hall.y; y < hall.y + hall.h; y += 1) {
      for (let x = hall.x; x < hall.x + hall.w; x += 1) {
        if (taken.has(y * world.size + x)) continue;
        if (isWalkable(world.size, blocked, x, y)) return { x, y };
      }
    }
  }
  void guestId;
  return door;
}

export function exchangePoint(world: WorldState): Point | null {
  const desk = world.furniture.find((item) => item.kind === 'EXCHANGE');
  return desk ? interactionPoint(world, desk) : null;
}

export function guestById(world: WorldState, id: number): Guest | null {
  return world.guests.find((guest) => guest.id === id) ?? null;
}

export function sendGuest(world: WorldState, guest: Guest, target: Point): void {
  guest.path = pathTo(world, guest.position, target);
  guest.pathIndex = 0;
}

export function canPlace(world: WorldState, x: number, y: number, w: number, h: number, needsAccess = true): boolean {
  const blockers = [world.player.position, ...world.guests.map((guest) => guest.position)];
  return canPlaceAt(world.size, world.furniture, blockers, x, y, w, h, needsAccess);
}
