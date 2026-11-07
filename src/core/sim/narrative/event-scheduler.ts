/** Scheduler fuer narrative Event-Instanzen; Auswahl ist deterministisch und begrenzt. */
import type { WorldState } from '../types';
import {
  eventOccurrenceKey, expireDueEvents, isLiveEventStatus, pruneEventInstances, transitionEvent,
} from './event-lifecycle';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { isEventCandidate } from './event-schema';
import { narrativeIndex } from './narrative-rng';
import { isStaffRef, visitorIdOf } from './relationships';
import { NARRATIVE_LIMITS, type NarrativeState } from './types';

const MAX_NEW_EVENTS = 3;
const MAX_CANDIDATES = 64;
const DEFAULT_TTL = 20;
const safeTick = (tick: number): number => (Number.isSafeInteger(tick) && tick >= 0 ? tick : 0);

const keyOf = (candidate: EventCandidate): string =>
  eventOccurrenceKey(candidate.scope, candidate.eventId, candidate.participants);

function activeCount(state: NarrativeState): number {
  return state.events.filter((event) => isLiveEventStatus(event.status)).length;
}

function lastScheduledTick(state: NarrativeState, candidate: EventCandidate): number {
  const key = keyOf(candidate);
  return state.events
    .filter((event) => eventOccurrenceKey(event.scope, event.eventId, event.participants) === key)
    .reduce((last, event) => Math.max(last, event.updatedTick), -1);
}

function occurrenceCount(state: NarrativeState, candidate: EventCandidate): number {
  const key = keyOf(candidate);
  return state.events.filter((event) => eventOccurrenceKey(event.scope, event.eventId, event.participants) === key).length;
}

function hasLiveDuplicate(state: NarrativeState, candidate: EventCandidate): boolean {
  const key = keyOf(candidate);
  return state.events.some((event) => isLiveEventStatus(event.status)
    && eventOccurrenceKey(event.scope, event.eventId, event.participants) === key);
}

function isCoolingDown(state: NarrativeState, candidate: EventCandidate, tick: number): boolean {
  const key = keyOf(candidate);
  return state.cooldowns.some((cooldown) => cooldown.key === key && cooldown.untilTick > tick);
}

/** Prueft alle Invarianten vor dem Anlegen einer Instanz. */
export function canScheduleEvent(world: WorldState, candidate: EventCandidate, tick = world.tick): boolean {
  if (!isEventCandidate(candidate)) return false;
  const state = world.narrative;
  const at = safeTick(tick);
  if (activeCount(state) >= NARRATIVE_LIMITS.activeEvents) return false;
  const limit = candidate.maxOccurrences ?? 1;
  // 0 bedeutet unbegrenzt; dann reguliert allein der Cooldown den Abstand.
  if (limit > 0 && occurrenceCount(state, candidate) >= limit) return false;
  if (hasLiveDuplicate(state, candidate) || isCoolingDown(state, candidate, at)) return false;
  const chain = candidate.chainFromEventId;
  if (chain !== undefined && chain !== null) {
    const prior = state.events.find((event) => event.id === chain);
    if (!prior || prior.status !== 'RESOLVED') return false;
  }
  return true;
}

function pickCandidate(state: NarrativeState, candidates: readonly EventCandidate[]): EventCandidate {
  const ranked = candidates.map((candidate) => ({
    candidate, last: lastScheduledTick(state, candidate), key: keyOf(candidate),
  })).sort((a, b) => b.candidate.priority - a.candidate.priority
    || a.last - b.last || a.key.localeCompare(b.key));
  const head = ranked[0]!;
  const tied = ranked.filter((entry) => entry.candidate.priority === head.candidate.priority && entry.last === head.last);
  if (tied.length === 1) return head.candidate;
  const draw = narrativeIndex(state.rng, tied.length);
  state.rng = draw.rng;
  return tied[draw.index]!.candidate;
}

/** Legt genau eine Instanz an; `OFFERED` ist der sichere Default fuer die UI-Seite. */
export function scheduleEvent(
  world: WorldState,
  candidate: EventCandidate,
  status: 'OFFERED' | 'ACTIVE' = 'OFFERED',
  tick = world.tick,
): NarrativeEventInstance | null {
  const at = safeTick(tick);
  if (!canScheduleEvent(world, candidate, at)) return null;
  const state = world.narrative;
  const instance: NarrativeEventInstance = {
    id: state.eventSeq,
    eventId: candidate.eventId,
    templateId: candidate.templateId ?? candidate.eventId,
    templateVersion: candidate.templateVersion ?? 1,
    offeredChoiceIds: [...(candidate.offeredChoiceIds ?? [])],
    status: 'ELIGIBLE',
    scope: candidate.scope,
    participants: [...candidate.participants],
    sourceFactId: candidate.sourceFactId,
    priority: candidate.priority,
    startedTick: at,
    updatedTick: at,
    expiresTick: at + (candidate.expiresInTicks ?? DEFAULT_TTL),
    step: candidate.step ?? 'START',
    maxOccurrences: candidate.maxOccurrences ?? 1,
    cooldownTicks: candidate.cooldownTicks ?? 0,
    chainFromEventId: candidate.chainFromEventId ?? null,
    resolution: null,
  };
  state.eventSeq += 1;
  state.events.push(instance);
  pruneEventInstances(state);
  if (!transitionEvent(world, instance.id, status, at)) {
    state.events = state.events.filter((event) => event.id !== instance.id);
    return null;
  }
  return state.events.find((event) => event.id === instance.id) ?? null;
}

/** Begrenzte Auswahl: hohe Prioritaet, dann aeltester letzter Einsatz; Ties via Narrativ-RNG. */
export function scheduleCandidates(world: WorldState, candidates: readonly EventCandidate[], tick = world.tick): NarrativeEventInstance[] {
  const at = safeTick(tick);
  const pending = candidates.filter(isEventCandidate).slice(0, MAX_CANDIDATES);
  const created: NarrativeEventInstance[] = [];
  while (created.length < MAX_NEW_EVENTS) {
    const eligible = pending.filter((candidate) => canScheduleEvent(world, candidate, at));
    if (eligible.length === 0) break;
    const selected = pickCandidate(world.narrative, eligible);
    const instance = scheduleEvent(world, selected, 'OFFERED', at);
    if (!instance) break;
    created.push(instance);
    const index = pending.indexOf(selected);
    if (index >= 0) pending.splice(index, 1);
  }
  return created;
}

function participantAlive(world: WorldState, ref: string): boolean {
  if (ref === 'player') return true;
  const visitorId = visitorIdOf(ref as `visitor:${number}`);
  if (visitorId !== null) return world.visitors.some((visitor) => visitor.id === visitorId);
  if (isStaffRef(ref as `staff:${number}`)) {
    const id = Number(ref.slice('staff:'.length));
    return world.agents.some((agent) => agent.id === id);
  }
  return true;
}

/** Bricht Instanzen ab, deren Visitor-/Personal-Endpunkt nicht mehr existiert. */
export function cancelStaleEvents(world: WorldState, tick = world.tick): number {
  let cancelled = 0;
  for (const event of [...world.narrative.events]) {
    if (isLiveEventStatus(event.status) && !event.participants.every((ref) => participantAlive(world, ref))
      && transitionEvent(world, event.id, 'CANCELLED', tick, 'MISSING_PARTICIPANT')) cancelled += 1;
  }
  return cancelled;
}

/** Ein Aufraeumlauf fuer den Boundary: Fristen und verwaiste Teilnehmer. */
export function maintainEvents(
  world: WorldState,
  tick = world.tick,
): { readonly cancelled: number; readonly expired: readonly NarrativeEventInstance[] } {
  const cancelled = cancelStaleEvents(world, tick);
  const expired = expireDueEvents(world, tick);
  return { cancelled, expired };
}

/** Eine Folgeinstanz ist nur nach einem aufgeloesten Vorgaenger erlaubt. */
export function chainEvent(
  world: WorldState,
  priorEventId: number,
  candidate: EventCandidate,
  tick = world.tick,
  status: 'OFFERED' | 'ACTIVE' = 'OFFERED',
): NarrativeEventInstance | null {
  const prior = world.narrative.events.find((event) => event.id === priorEventId);
  if (!prior || prior.status !== 'RESOLVED') return null;
  return scheduleEvent(world, { ...candidate, chainFromEventId: prior.id }, status, tick);
}
