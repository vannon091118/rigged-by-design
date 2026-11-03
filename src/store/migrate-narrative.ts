/** Hydration der Narrative-Domaene und der Besucher-Erinnerungen beim Laden. */
import { startDemandEvent } from '../core/sim/narrative/demand-events';
import { normalizeMemories, normalizeNarrativeState } from '../core/sim/narrative/state';
import type { DemandEvent, Visitor, WorldState } from '../core/sim/types';

interface SavedNarrativeSlice {
  readonly visitors?: Visitor[];
  readonly nextVisitorId?: number;
  readonly narrative?: unknown;
  readonly demandEvent?: DemandEvent | null;
}

function asDemandEvent(raw: unknown): DemandEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as { kind?: unknown; untilTick?: unknown };
  if (entry.kind !== 'NEON_NACHT' && entry.kind !== 'TURNIER_ABEND') return null;
  if (typeof entry.untilTick !== 'number' || !Number.isFinite(entry.untilTick)) return null;
  return { kind: entry.kind, untilTick: Math.floor(entry.untilTick) };
}

/** v5–v8 trugen die Veranstaltung auf der Welt, v9 im Narrativ-Slice. */
function legacyDemandEvent(saved: SavedNarrativeSlice): DemandEvent | null {
  const narrative = typeof saved.narrative === 'object' && saved.narrative !== null
    ? saved.narrative as { demandEvent?: unknown }
    : null;
  return asDemandEvent(narrative?.demandEvent) ?? asDemandEvent(saved.demandEvent);
}

/** Setzt Besucher inklusive Erinnerungen und den Narrativ-Zustand mit sicheren Defaults. */
export function hydrateNarrative(world: WorldState, saved: SavedNarrativeSlice): void {
  // Alte Profile ohne Erinnerungsfeld behalten ihre Form; vorhandene werden normalisiert.
  world.visitors = (saved.visitors ?? []).map((visitor) => (visitor.memories === undefined
    ? { ...visitor }
    : { ...visitor, memories: normalizeMemories(visitor.memories) }));
  world.nextVisitorId = saved.nextVisitorId ?? world.visitors.reduce((max, visitor) => Math.max(max, visitor.id + 1), 1);
  world.narrative = normalizeNarrativeState(saved.narrative);
  // Eine laufende Alt-Veranstaltung wird zur aktiven Event-Instanz; abgelaufene verfallen.
  const legacy = legacyDemandEvent(saved);
  if (legacy && legacy.untilTick > world.tick) startDemandEvent(world, legacy.kind, legacy.untilTick - world.tick);
}
