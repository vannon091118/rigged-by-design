/** Hydration von Flecken und Wischern für Save-Migration (v9). */
import type { WorldState } from '../core/sim/types';
import type { SavedGame } from './migrate';

export function hydrateStainsAndMops(world: WorldState, saved: SavedGame): void {
  world.stains = (saved.stains ?? []).map((stain) => ({ ...stain }));
  world.mops = (saved.mops ?? []).map((mop) => ({ ...mop, carriedBy: mop.carriedBy ?? null }));
  world.nextStainId = saved.nextStainId ?? world.stains.reduce((max, s) => Math.max(max, s.id + 1), 1);
  world.nextMopId = saved.nextMopId ?? world.mops.reduce((max, m) => Math.max(max, m.id + 1), 1);
}
