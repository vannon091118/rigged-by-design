/** Bruecke zwischen Demand-Balance und gemeinsamer Event-Engine. */
import type { DemandEventKind, WorldState } from '../types';
import { isLiveEventStatus, transitionEvent } from './event-lifecycle';
import { scheduleEvent } from './event-scheduler';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { demandDefinition, isDemandEventId } from './events/demand-definitions';

/** Engine-erzeugte Events ohne ausloesenden Fact (Tagesgrenze, Save-Migration). */
const ENGINE_EVENT_SOURCE = 0;

export function activeDemandEvent(world: WorldState): NarrativeEventInstance | null {
  return world.narrative.events.find((event) => isLiveEventStatus(event.status) && isDemandEventId(event.eventId)) ?? null;
}

export function activeDemandKind(world: WorldState): DemandEventKind | null {
  const event = activeDemandEvent(world);
  return event && isDemandEventId(event.eventId) ? event.eventId : null;
}

function demandCandidate(kind: DemandEventKind, expiresInTicks?: number): EventCandidate {
  const definition = demandDefinition(kind);
  return {
    eventId: definition.kind,
    templateId: definition.kind,
    templateVersion: 1,
    offeredChoiceIds: [],
    priority: 0,
    scope: 'GLOBAL',
    participants: [],
    sourceFactId: ENGINE_EVENT_SOURCE,
    expiresInTicks: expiresInTicks ?? definition.durationTicks,
    cooldownTicks: 0,
    maxOccurrences: definition.maxOccurrences,
    step: 'START',
  };
}

/** Startet hoechstens eine Veranstaltung; der Scheduler verhindert Live-Duplikate. */
export function startDemandEvent(
  world: WorldState, kind: DemandEventKind, expiresInTicks?: number,
): NarrativeEventInstance | null {
  if (activeDemandEvent(world)) return null;
  return scheduleEvent(world, demandCandidate(kind, expiresInTicks), 'ACTIVE', world.tick);
}

/** Beendet die laufende Veranstaltung an ihrem Fristtick; liefert die beendete Art. */
export function endDueDemandEvent(world: WorldState): DemandEventKind | null {
  const event = activeDemandEvent(world);
  if (!event || event.expiresTick > world.tick || !isDemandEventId(event.eventId)) return null;
  return transitionEvent(world, event.id, 'EXPIRED', world.tick, 'DEMAND_ENDED') ? event.eventId : null;
}
