/** Hydration der Narrative-Domaene und der Besucher-Erinnerungen beim Laden. */
import { startDemandEvent } from '../core/sim/narrative/demand-events';
import { demandDefinition } from '../core/sim/narrative/events/demand-definitions';
import { normalizeMemories, normalizeNarrativeState } from '../core/sim/narrative/state';
import { recordJournal } from '../core/sim/journal';
import type { DemandEventKind, Visitor, WorldState } from '../core/sim/types';
import type { DemandEvent } from './legacy-demand';

/** Was die Migration tatsaechlich getan hat; der Ladepfad macht es sichtbar. */
export interface MigrationReport {
  readonly legacyKind: DemandEventKind | null;
  readonly demandStarted: boolean;
  readonly untilTickClamped: boolean;
  readonly conflictingLegacy: boolean;
}

interface SavedNarrativeSlice {
  readonly visitors?: Visitor[];
  readonly nextVisitorId?: number;
  readonly narrative?: unknown;
  readonly demandEvent?: DemandEvent | null;
}

const NO_MIGRATION: MigrationReport = {
  legacyKind: null, demandStarted: false, untilTickClamped: false, conflictingLegacy: false,
};

function asDemandEvent(raw: unknown): DemandEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as { kind?: unknown; untilTick?: unknown };
  if (entry.kind !== 'NEON_NACHT' && entry.kind !== 'TURNIER_ABEND') return null;
  if (typeof entry.untilTick !== 'number' || !Number.isFinite(entry.untilTick)) return null;
  const untilTick = Math.floor(entry.untilTick);
  return Number.isSafeInteger(untilTick) ? { kind: entry.kind, untilTick } : null;
}

/**
 * v5–v8 trugen die Veranstaltung auf der Welt, v9 im Narrativ-Slice. Beide
 * Quellen werden verglichen: bei Widerspruch gewinnt die spaeter endende, damit
 * eine noch laufende Veranstaltung nicht stillschweigend verkuerzt wird.
 */
function legacyDemandEvent(saved: SavedNarrativeSlice): {
  readonly event: DemandEvent | null;
  readonly conflicting: boolean;
} {
  const narrative = typeof saved.narrative === 'object' && saved.narrative !== null
    ? saved.narrative as { demandEvent?: unknown }
    : null;
  const fromNarrative = asDemandEvent(narrative?.demandEvent);
  const fromRoot = asDemandEvent(saved.demandEvent);
  if (!fromNarrative) return { event: fromRoot, conflicting: false };
  if (!fromRoot) return { event: fromNarrative, conflicting: false };
  const conflicting = fromNarrative.kind !== fromRoot.kind || fromNarrative.untilTick !== fromRoot.untilTick;
  return { event: fromRoot.untilTick > fromNarrative.untilTick ? fromRoot : fromNarrative, conflicting };
}

/** Setzt Besucher inklusive Erinnerungen und den Narrativ-Zustand mit sicheren Defaults. */
export function hydrateNarrative(world: WorldState, saved: SavedNarrativeSlice): MigrationReport {
  // Alte Profile ohne Erinnerungsfeld behalten ihre Form; vorhandene werden normalisiert.
  world.visitors = (saved.visitors ?? []).map((visitor) => (visitor.memories === undefined
    ? { ...visitor }
    : { ...visitor, memories: normalizeMemories(visitor.memories) }));
  world.nextVisitorId = saved.nextVisitorId ?? world.visitors.reduce((max, visitor) => Math.max(max, visitor.id + 1), 1);
  world.narrative = normalizeNarrativeState(saved.narrative);
  // Eine laufende Alt-Veranstaltung wird zur aktiven Event-Instanz; abgelaufene verfallen.
  const legacy = legacyDemandEvent(saved);
  if (!legacy.event) {
    return legacy.conflicting ? { ...NO_MIGRATION, conflictingLegacy: true } : NO_MIGRATION;
  }
  const kind = legacy.event.kind;
  if (legacy.event.untilTick <= world.tick) {
    return { ...NO_MIGRATION, legacyKind: kind, conflictingLegacy: legacy.conflicting };
  }
  // Eine Alt-Veranstaltung darf nie laenger laufen als eine frisch gestartete.
  const maximum = demandDefinition(kind).durationTicks;
  const remaining = legacy.event.untilTick - world.tick;
  const clamped = remaining > maximum;
  const started = startDemandEvent(world, kind, Math.min(remaining, maximum)) !== null;
  return {
    legacyKind: kind,
    demandStarted: started,
    untilTickClamped: clamped,
    conflictingLegacy: legacy.conflicting,
  };
}

/** Eine Journal-Zeile genau dann, wenn die Migration etwas veraendert oder verworfen hat. */
export function recordNarrativeMigration(world: WorldState, report: MigrationReport): void {
  const parts: string[] = [];
  if (report.legacyKind) {
    const label = demandDefinition(report.legacyKind).label;
    if (report.demandStarted) parts.push(`${label} aus dem Spielstand uebernommen`);
    else parts.push(`${label} aus dem Spielstand nicht uebernommen`);
  }
  if (report.untilTickClamped) parts.push('Laufzeit auf die regulaere Dauer begrenzt');
  if (report.conflictingLegacy) parts.push('zwei widerspruechliche Alt-Quellen, spaetere gewaehlt');
  if (parts.length === 0) return;
  recordJournal(world, {
    kind: 'SYSTEM', subject: 'Spielstand', cause: 'Narrative-Migration',
    effect: parts.join('; '),
  });
}
