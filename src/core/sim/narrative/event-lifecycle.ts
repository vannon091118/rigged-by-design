/** Zentrale Event-State-Machine und Cooldown-Anwendung. */
import type { WorldState } from '../types';
import type {
  NarrativeCooldown, NarrativeEventInstance, NarrativeEventScope, NarrativeEventStatus,
} from './event-types';
import { NARRATIVE_LIMITS, type NarrativeState } from './types';

const ALLOWED: Record<NarrativeEventStatus, readonly NarrativeEventStatus[]> = {
  ELIGIBLE: ['OFFERED', 'ACTIVE', 'CANCELLED'],
  OFFERED: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  ACTIVE: ['RESOLVED', 'EXPIRED', 'CANCELLED'],
  RESOLVED: [],
  EXPIRED: [],
  CANCELLED: [],
};

const TERMINAL: readonly NarrativeEventStatus[] = ['RESOLVED', 'EXPIRED', 'CANCELLED'];
const STEP = /^[A-Z][A-Z0-9_]{0,31}$/;
const safeTick = (tick: number): number => (Number.isSafeInteger(tick) && tick >= 0 ? tick : 0);

export const isTerminalEventStatus = (status: NarrativeEventStatus): boolean => TERMINAL.includes(status);
export const isLiveEventStatus = (status: NarrativeEventStatus): boolean => status === 'OFFERED' || status === 'ACTIVE';

/** Der Scope-Schluessel verhindert Duplikate und Cooldowns pro Teilnehmerkombination. */
export function eventOccurrenceKey(
  scope: NarrativeEventScope,
  eventId: string,
  participants: readonly string[],
): string {
  const refs = scope === 'PAIR' ? [...participants].sort() : [...participants];
  return `${scope}:${eventId}:${refs.join(',')}`;
}

export function canTransitionEvent(from: NarrativeEventStatus, to: NarrativeEventStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** Haelt aktive Instanzen und begrenzt nur die abgeschlossene Historie. */
export function pruneEventInstances(state: NarrativeState): void {
  const live = state.events.filter((event) => !isTerminalEventStatus(event.status)).slice(-NARRATIVE_LIMITS.eventInstances);
  const historyLimit = Math.max(0, NARRATIVE_LIMITS.eventInstances - live.length);
  const history = historyLimit === 0 ? [] : state.events
    .filter((event) => isTerminalEventStatus(event.status))
    .sort((a, b) => a.id - b.id)
    .slice(-historyLimit);
  state.events = [...live, ...history].sort((a, b) => a.id - b.id);
}

function addCooldown(state: NarrativeState, event: NarrativeEventInstance, tick: number): void {
  if (event.cooldownTicks <= 0) return;
  const key = eventOccurrenceKey(event.scope, event.eventId, event.participants);
  const cooldown: NarrativeCooldown = {
    key,
    eventId: event.eventId,
    untilTick: tick + event.cooldownTicks,
    lastTick: tick,
  };
  const index = state.cooldowns.findIndex((entry) => entry.key === key);
  if (index >= 0) state.cooldowns[index] = cooldown;
  else state.cooldowns.push(cooldown);
  state.cooldowns.sort((a, b) => a.untilTick - b.untilTick || a.key.localeCompare(b.key));
  if (state.cooldowns.length > NARRATIVE_LIMITS.cooldowns) {
    state.cooldowns.splice(0, state.cooldowns.length - NARRATIVE_LIMITS.cooldowns);
  }
}

/** Einziger Schreibpfad fuer Statuswechsel; ungueltige Uebergaenge bleiben unveraendert. */
export function transitionEvent(
  world: WorldState,
  eventId: number,
  to: NarrativeEventStatus,
  tick: number,
  resolution: string | null = null,
): boolean {
  const state = world.narrative;
  const index = state.events.findIndex((event) => event.id === eventId);
  const event = state.events[index];
  if (!event || !canTransitionEvent(event.status, to)) return false;
  const now = safeTick(tick);
  const next: NarrativeEventInstance = {
    ...event,
    status: to,
    updatedTick: now,
    resolution: isTerminalEventStatus(to) ? resolution : event.resolution,
  };
  state.events[index] = next;
  if (isTerminalEventStatus(to)) {
    addCooldown(state, next, now);
    pruneEventInstances(state);
  }
  return true;
}

/** Aktualisiert nur den fachlichen Schritt, nicht den Lifecycle-Status. */
export function advanceEventStep(world: WorldState, eventId: number, step: string, tick: number): boolean {
  if (!STEP.test(step)) return false;
  const state = world.narrative;
  const index = state.events.findIndex((event) => event.id === eventId);
  const event = state.events[index];
  if (!event || !isLiveEventStatus(event.status)) return false;
  state.events[index] = { ...event, step, updatedTick: safeTick(tick) };
  return true;
}

/** Beendet abgelaufene Instanzen; bereits terminale Events werden nie erneut bewegt. */
export function expireDueEvents(world: WorldState, tick: number): number {
  let expired = 0;
  for (const event of [...world.narrative.events]) {
    if (isLiveEventStatus(event.status) && event.expiresTick <= tick
      && transitionEvent(world, event.id, 'EXPIRED', tick, 'DEADLINE')) expired += 1;
  }
  return expired;
}
