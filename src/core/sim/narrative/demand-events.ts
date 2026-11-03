/** Bruecke zwischen Demand-Balance und gemeinsamer Event-Engine. */
import type { DemandEventKind, WorldState } from '../types';
import { isLiveEventStatus } from './event-lifecycle';
import { scheduleEvent } from './event-scheduler';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { templateFor } from './events/definitions';
import { demandDefinition, isDemandEventId, type DemandEventDefinition } from './events/demand-definitions';

/** Engine-erzeugte Events ohne ausloesenden Fact (Tagesgrenze, Save-Migration). */
const ENGINE_EVENT_SOURCE = 0;

/** Liefert die laufende Veranstaltung samt ihrer Definition; null, wenn keine aktiv ist. */
export function activeDemand(world: WorldState): {
  readonly event: NarrativeEventInstance;
  readonly kind: DemandEventKind;
  readonly definition: DemandEventDefinition;
} | null {
  const event = world.narrative.events.find(
    (entry) => isLiveEventStatus(entry.status) && isDemandEventId(entry.eventId),
  );
  return event && isDemandEventId(event.eventId)
    ? { event, kind: event.eventId, definition: demandDefinition(event.eventId) }
    : null;
}

export function activeDemandEvent(world: WorldState): NarrativeEventInstance | null {
  return activeDemand(world)?.event ?? null;
}

function demandCandidate(kind: DemandEventKind, expiresInTicks?: number): EventCandidate | null {
  const template = templateFor(kind);
  if (!template) return null;
  return {
    eventId: template.eventId,
    templateId: template.eventId,
    templateVersion: template.version,
    offeredChoiceIds: [],
    priority: template.priority,
    scope: template.scope,
    participants: [],
    sourceFactId: ENGINE_EVENT_SOURCE,
    expiresInTicks: expiresInTicks ?? template.expiresInTicks,
    cooldownTicks: template.cooldownTicks,
    maxOccurrences: template.maxOccurrences,
    step: template.initialStep,
  };
}

/**
 * Startet hoechstens eine Veranstaltung. `normalizeEvents` haelt die Invariante
 * „eine lebende Instanz pro Demand-Familie" bereits beim Laden; der Scheduler
 * verhindert zusaetzlich Live-Duplikate und Cooldowns.
 */
export function startDemandEvent(
  world: WorldState, kind: DemandEventKind, expiresInTicks?: number,
): NarrativeEventInstance | null {
  if (activeDemand(world)) return null;
  const candidate = demandCandidate(kind, expiresInTicks);
  return candidate ? scheduleEvent(world, candidate, 'ACTIVE', world.tick) : null;
}
