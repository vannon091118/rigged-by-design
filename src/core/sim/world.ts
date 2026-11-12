/** Welt-Helfer: Zonen, Objekte, Reservierungen, freie Plaetze. */
import { canPlaceAt } from './grid-zones';
import { navGrid, tileIndex, type NavGrid } from './nav-grid';
import { accessPoints, approachPoint, findPath, isWalkable, nearestWalkable } from './pathfinding';
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

/**
 * Das eine Navigationsraster der aktiven Welt. Die Stadt traegt ihr eigenes
 * 60x60-Layout; wer im Stadt-Floor klickt, darf nicht am alten 30er-Casino
 * haengen bleiben. Ein Casino/ eine Wohnung nutzt weiterhin `world.layout`.
 */
export function worldNav(world: WorldState): NavGrid {
  const city = world.scene.kind === 'CITY' ? world.cityScene : null;
  const layout = city?.layout ?? world.layout;
  return navGrid(layout.size, city?.furniture ?? world.furniture, layout);
}

/** Mehrere Zugaenge je Objekt; jeder liegt frei und teilt eine offene Kante mit ihm. */
function interactionPoints(world: WorldState, item: Furniture): Point[] {
  return accessPoints(worldNav(world), item);
}

/**
 * Ein Zugang nach Wahl (z. B. je Sitz oder Gast), damit Bars und Tische nicht
 * auf einen einzigen Punkt beschraenkt sind. Ohne Zugang greift die alte
 * `approachPoint`-Regel als sicherer Fallback.
 */
export function interactionPoint(world: WorldState, item: Furniture, slot = 0): Point | null {
  const points = interactionPoints(world, item);
  if (points.length === 0) return approachPoint(worldNav(world), item);
  return points[Math.abs(slot) % points.length]!;
}

/** Jeder Sitz bekommt ein eigenes Zugaengliches Tile; sonst stehen alle Gaeste auf demselben Punkt. */
export function seatPoint(world: WorldState, item: Furniture, seat: number): Point | null {
  return interactionPoint(world, item, seat);
}

export function pathTo(world: WorldState, from: Point, to: Point): Point[] {
  return findPath(guestNav(world), from, to);
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

/** Gaeste duerfen den Eingangsstreifen auch dann betreten, wenn dort etwas steht. */
function guestNav(world: WorldState): NavGrid {
  const nav = worldNav(world);
  const blocked = new Set(nav.blocked);
  for (const spot of entranceApron(world)) {
    if (spot.x < 0 || spot.y < 0 || spot.x >= nav.size || spot.y >= nav.size) continue;
    blocked.delete(tileIndex(nav.size, spot.x, spot.y));
  }
  return { size: nav.size, blocked, walls: nav.walls };
}

/** Gaeste erscheinen vor der Tuer und gehen von dort durch den Eingang. */
export function spawnPoint(world: WorldState): Point {
  const nav = worldNav(world);
  const door = doorPoint(world);
  return isWalkable(nav, door.x, door.y) ? door : nearestWalkable(nav, door) ?? door;
}

/**
 * Eigener Aussenplatz je Gast: niemand spawnt auf dem Tile eines anderen und
 * niemand in einem Moebel. Erst der Streifen an der Tuer, bei Andrang die Halle.
 */
export function entranceSpot(world: WorldState, guestId = 0): Point {
  const nav = worldNav(world);
  const taken = new Set(world.guests.map((guest) => guest.position.y * world.size + guest.position.x));
  for (const spot of entranceApron(world)) {
    if (spot.x < 0 || spot.y < 0 || spot.x >= world.size || spot.y >= world.size) continue;
    if (taken.has(spot.y * world.size + spot.x) || !isWalkable(nav, spot.x, spot.y)) continue;
    return spot;
  }
  const hall = world.zones.find((zone) => zone.kind === 'ENTRANCE');
  if (hall) {
    for (let y = hall.y; y < hall.y + hall.h; y += 1) {
      for (let x = hall.x; x < hall.x + hall.w; x += 1) {
        if (taken.has(y * world.size + x)) continue;
        if (isWalkable(nav, x, y)) return { x, y };
      }
    }
  }
  void guestId;
  return spawnPoint(world);
}

export function exchangePoint(world: WorldState): Point | null {
  const desk = world.furniture.find((item) => item.kind === 'EXCHANGE');
  return desk ? interactionPoint(world, desk) : null;
}

export function guestById(world: WorldState, id: number): Guest | null {
  return world.guests.find((guest) => guest.id === id) ?? null;
}

/** Schickt einen Gast auf ein Ziel; false, wenn es keinen Weg dorthin gibt. */
export function sendGuest(world: WorldState, guest: Guest, target: Point): boolean {
  guest.path = pathTo(world, guest.position, target);
  guest.pathIndex = 0;
  return guest.path.length > 0;
}

export function canPlace(world: WorldState, x: number, y: number, w: number, h: number, needsAccess = true): boolean {
  const blockers = [world.player.position, ...world.guests.map((guest) => guest.position)];
  return canPlaceAt(world.size, world.furniture, blockers, x, y, w, h, needsAccess, world.layout);
}
