/** Erreichbarkeit ueber offene Kanten: BFS fuer Zielpruefung und Platzierungsschutz. */
import { stepOpen, tileIndex, withBlocked, type NavGrid } from './nav-grid';
import { accessPointsFor } from './pathfinding';
import type { Furniture, Point } from './types';

const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const SERVICE_KINDS: ReadonlySet<string> = new Set(['EXCHANGE', 'BAR', 'TOILET', 'STORAGE', 'JOB_STATION']);

const isService = (item: Furniture): boolean => SERVICE_KINDS.has(item.kind);

/** Alle Tiles, die von `start` aus ueber offene Kanten erreichbar sind. */
export function reachableTiles(nav: NavGrid, start: Point): Set<number> {
  const reached = new Set<number>();
  if (start.x < 0 || start.y < 0 || start.x >= nav.size || start.y >= nav.size) return reached;
  const startIndex = tileIndex(nav.size, start.x, start.y);
  if (nav.blocked.has(startIndex)) return reached;
  const stack: Point[] = [{ x: start.x, y: start.y }];
  reached.add(startIndex);
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const [dx, dy] of STEPS) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= nav.size || next.y >= nav.size) continue;
      const index = tileIndex(nav.size, next.x, next.y);
      if (reached.has(index) || nav.blocked.has(index)) continue;
      if (!stepOpen(nav, current, next)) continue;
      reached.add(index);
      stack.push(next);
    }
  }
  return reached;
}

/** Serviceobjekte ohne erreichbaren Zugang; leer heisst: alle sind bedienbar. */
function unreachableServices(nav: NavGrid, furniture: readonly Furniture[], start: Point): Set<number> {
  const reached = reachableTiles(nav, start);
  const missing = new Set<number>();
  for (const item of furniture) {
    if (!isService(item)) continue;
    const points = accessPointsFor(nav, item.x, item.y, item.w, item.h);
    if (!points.some((point) => reached.has(tileIndex(nav.size, point.x, point.y)))) missing.add(item.id);
  }
  return missing;
}

/**
 * Eine Platzierung darf keinen bisher bedienbaren Service abschneiden. Was
 * schon vorher unerreichbar war, blockiert die Pruefung nicht.
 */
export function keepsServicesReachable(
  nav: NavGrid,
  furniture: readonly Furniture[],
  start: Point,
  occupied: Iterable<number>,
): boolean {
  if (!furniture.some((item) => isService(item))) return true;
  const before = unreachableServices(nav, furniture, start);
  const after = unreachableServices(withBlocked(nav, occupied), furniture, start);
  for (const id of after) if (!before.has(id)) return false;
  return true;
}
