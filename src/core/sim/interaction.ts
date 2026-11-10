/**
 * Interaktion: Radius, Annaeherung und Zielpfad fuer Maus, Tastatur und Touch.
 * Headless und deterministisch; die Figur laeuft ueber den Pfad, sie springt nicht.
 */
import { accessPoints, findPath, isWalkable } from './pathfinding';
import type { Furniture, Point, WorldState } from './types';
import { furnitureById, guestById, worldNav } from './world';

export function isInRange(from: Point, to: Point, radius: number): boolean {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= radius;
}

/** Eine Tabelle fuer alle Pfade: Annaeherung, Aktionen und Anzeige lesen dieselben Werte. */
export const INTERACTION_RADII = {
  STAIN: 1,
  MOP: 1,
  GUEST: 2,
  TOILET: 2,
  BAR: 2,
  STORAGE: 2,
  EXCHANGE: 4,
  CRATE: 2,
  FURNITURE: 2,
  DESK: 4,
  DISPUTE: 4,
} as const;

export type InteractionKind = 'guest' | 'furniture' | 'crate' | 'stain';

export interface InteractionTarget {
  readonly kind: InteractionKind;
  readonly id: number;
}

export interface InteractionPlan {
  readonly target: InteractionTarget;
  /** Kachel, auf der die Figur stehen muss, um zu handeln. */
  readonly spot: Point | null;
  readonly path: readonly Point[];
  readonly reach: number;
  readonly inRange: boolean;
  readonly reachable: boolean;
  /** Leer, wenn erreichbar; sonst der Grund in Spielersprache. */
  readonly reason: string;
}

interface Resolved {
  readonly point: Point;
  readonly reach: number;
  readonly item?: Furniture;
}

const REACH_BY_FURNITURE: Partial<Record<Furniture['kind'], number>> = {
  BAR: INTERACTION_RADII.BAR,
  STORAGE: INTERACTION_RADII.STORAGE,
  TOILET: INTERACTION_RADII.TOILET,
  EXCHANGE: INTERACTION_RADII.EXCHANGE,
};

function resolve(world: WorldState, target: InteractionTarget): Resolved | null {
  if (target.kind === 'guest') {
    const guest = guestById(world, target.id);
    return guest ? { point: guest.position, reach: INTERACTION_RADII.GUEST } : null;
  }
  if (target.kind === 'furniture') {
    const item = furnitureById(world, target.id);
    if (!item) return null;
    return {
      point: { x: item.x + item.w / 2, y: item.y + item.h / 2 },
      reach: REACH_BY_FURNITURE[item.kind] ?? INTERACTION_RADII.FURNITURE,
      item,
    };
  }
  if (target.kind === 'crate') {
    const crate = world.crates.find((entry) => entry.id === target.id);
    return crate ? { point: { x: crate.x, y: crate.y }, reach: INTERACTION_RADII.CRATE } : null;
  }
  const stain = world.stains.find((entry) => entry.id === target.id);
  return stain ? { point: { x: stain.x, y: stain.y }, reach: INTERACTION_RADII.STAIN } : null;
}

/** Freie Kacheln, von denen aus das Ziel bedient werden kann. */
function spotsFor(
  world: WorldState,
  target: InteractionTarget,
  point: Point,
  reach: number,
  item?: Furniture,
): Point[] {
  const nav = worldNav(world);
  if (item) return accessPoints(nav, item);
  const spots: Point[] = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (Math.abs(dx) + Math.abs(dy) > reach) continue;
      if (dx === 0 && dy === 0 && target.kind === 'guest') continue;
      const spot = { x: point.x + dx, y: point.y + dy };
      if (isWalkable(nav, spot.x, spot.y)) spots.push(spot);
    }
  }
  return spots;
}

const failed = (target: InteractionTarget, reach: number, reason: string): InteractionPlan => ({
  target,
  spot: null,
  path: [],
  reach,
  inRange: false,
  reachable: false,
  reason,
});

/** Kuerzester Weg, dann feste Reihenfolge: nicht die Array-Reihenfolge entscheiden lassen. */
function better(path: readonly Point[], spot: Point, best: { path: readonly Point[]; spot: Point }): boolean {
  if (path.length !== best.path.length) return path.length < best.path.length;
  if (spot.y !== best.spot.y) return spot.y < best.spot.y;
  return spot.x < best.spot.x;
}

/**
 * Was passiert bei einem Klick auf dieses Ziel? Der Plan nennt den Standplatz,
 * den Weg dorthin und – falls es ihn nicht gibt – den Grund in Spielersprache.
 */
export function planInteraction(world: WorldState, target: InteractionTarget): InteractionPlan {
  const resolved = resolve(world, target);
  if (!resolved) return failed(target, INTERACTION_RADII.FURNITURE, 'Das Ziel gibt es nicht mehr.');
  const nav = worldNav(world);
  const from = world.player.position;
  if (!isWalkable(nav, from.x, from.y)) {
    return failed(target, resolved.reach, 'Deine Figur steht ausserhalb des begehbaren Bodens.');
  }
  const spots = spotsFor(world, target, resolved.point, resolved.reach, resolved.item);
  if (spots.length === 0) return failed(target, resolved.reach, 'Kein Zugang: Das Ziel ist eingebaut.');
  let best: { spot: Point; path: Point[] } | null = null;
  for (const spot of spots) {
    const path = findPath(nav, from, spot);
    if (path.length === 0) continue;
    if (!best || better(path, spot, best)) best = { spot, path };
  }
  if (!best) return failed(target, resolved.reach, 'Kein Weg frei: Etwas versperrt den Weg.');
  return {
    target,
    spot: best.spot,
    path: best.path,
    reach: resolved.reach,
    inRange: best.path.length <= 1,
    reachable: true,
    reason: '',
  };
}

/** Der eine Annaeherungsschritt: Plan, Weg setzen – die Figur laeuft, sie springt nicht. */
export function approachTarget(world: WorldState, target: InteractionTarget): InteractionPlan {
  const plan = planInteraction(world, target);
  world.player.path = plan.reachable && !plan.inRange ? [...plan.path] : [];
  world.player.pathIndex = 0;
  return plan;
}

export function stopPlayer(world: WorldState): void {
  world.player.path = [];
  world.player.pathIndex = 0;
}
