/** Hydration der Narrative-Domaene und der Besucher-Erinnerungen beim Laden. */
import { normalizeMemories, normalizeNarrativeState } from '../core/sim/narrative/state';
import type { Visitor, WorldState } from '../core/sim/types';

interface SavedNarrativeSlice {
  readonly visitors?: Visitor[];
  readonly nextVisitorId?: number;
  readonly narrative?: unknown;
}

/** Setzt Besucher inklusive Erinnerungen und den Narrativ-Zustand mit sicheren Defaults. */
export function hydrateNarrative(world: WorldState, saved: SavedNarrativeSlice): void {
  // Alte Profile ohne Erinnerungsfeld behalten ihre Form; vorhandene werden normalisiert.
  world.visitors = (saved.visitors ?? []).map((visitor) => (visitor.memories === undefined
    ? { ...visitor }
    : { ...visitor, memories: normalizeMemories(visitor.memories) }));
  world.nextVisitorId = saved.nextVisitorId ?? world.visitors.reduce((max, visitor) => Math.max(max, visitor.id + 1), 1);
  world.narrative = normalizeNarrativeState(saved.narrative);
}
