/** Werkzeugwahl der Auftragskette: vorhandener Wischer oder genau ein neuer an der Toilette. */
import type { InteractionTarget } from './interaction';
import { spawnMop } from './mop';
import type { WorldState } from './types';
import { interactionPoint } from './world';

export function toiletTarget(world: WorldState): InteractionTarget | null {
  const toilet = world.furniture.find((item) => item.kind === 'TOILET');
  return toilet ? { kind: 'furniture', id: toilet.id } : null;
}

export function toolTarget(world: WorldState): InteractionTarget | null {
  const free = world.mops.find((mop) => mop.carriedBy === null);
  if (free) return { kind: 'mop', id: free.id };
  const toilet = world.furniture.find((item) => item.kind === 'TOILET');
  if (!toilet) return null;
  const spot = interactionPoint(world, toilet) ?? { x: toilet.x + 1, y: toilet.y + toilet.h };
  spawnMop(world, spot.x, spot.y);
  const spawned = world.mops[world.mops.length - 1];
  return spawned ? { kind: 'mop', id: spawned.id } : null;
}
