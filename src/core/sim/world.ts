/** Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. */
import { canPlaceAt } from './grid-zones';
import { blockedTiles, approachPoint, findPath, isWalkable, nearestWalkable } from './pathfinding';
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
  return findPath(world.size, blockedTiles(world.size, world.furniture), from, to);
}

export function spawnPoint(world: WorldState): Point {
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0]!;
  return nearestWalkable(world.size, blockedTiles(world.size, world.furniture), {
    x: entrance.x + 1,
    y: entrance.y + Math.floor(entrance.h / 2),
  }) ?? { x: entrance.x + 1, y: entrance.y + 1 };
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
