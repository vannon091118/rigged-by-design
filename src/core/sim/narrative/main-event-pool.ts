/**
 * P-22 Main-Event-Pool: feste, normale Szenen werden nur bei idle gezogen.
 * Die Gewichte liegen in der Influence-Config und lesen die gerichtete
 * Beziehung zwischen den Teilnehmern; kein UI-Flag, kein Sonder-Log.
 */
import type { WorldState } from '../types';
import { influenceScore } from '../influence';
import {
  INFLUENCE_CONFIG, validateInfluenceConfig,
  type InfluenceConfig, type InfluenceValues,
} from '../influence-config';
import { offerChoiceIds } from './choices/contract';
import { isLiveEventStatus } from './event-lifecycle';
import { canScheduleEvent, scheduleEvent } from './event-scheduler';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { templateFor } from './events/definitions';
import { ENGINE_POOL_TRIGGER, type EventTemplate } from './events/template-types';
import { nextNarrativeRandom } from './narrative-rng';
import { actorRefOfVisitor, relationshipBetween, visitorIdOf } from './relationships';
import type { ActorRef, RelationshipEdge } from './types';

const POOL_SOURCE_FACT = 0;
const PAIR = (from: ActorRef, to: ActorRef): readonly [ActorRef, ActorRef] => [from, to];
const edgeStrength = (edge: RelationshipEdge | null): number => edge
  ? Math.abs(edge.trust) + Math.abs(edge.sympathy) + Math.abs(edge.conflict) : -1;

function presentVisitors(world: WorldState): ActorRef[] {
  return [...new Set(world.guests.map((guest) => guest.visitorId)
    .filter((id): id is number => id !== undefined))].sort((a, b) => a - b).map(actorRefOfVisitor);
}

/** Waehlt das staerkste gerichtete Paar; ohne Kante das erste Paar. */
function pairFor(world: WorldState): readonly [ActorRef, ActorRef] | null {
  const refs = presentVisitors(world);
  if (refs.length < 2) return null;
  let best: { readonly pair: readonly [ActorRef, ActorRef]; readonly strength: number } | null = null;
  for (let left = 0; left < refs.length; left += 1) {
    for (let right = left + 1; right < refs.length; right += 1) {
      const a = refs[left]!;
      const b = refs[right]!;
      const forward = relationshipBetween(world, a, b);
      const reverse = relationshipBetween(world, b, a);
      const pair = edgeStrength(reverse) > edgeStrength(forward) ? PAIR(b, a) : PAIR(a, b);
      const strength = Math.max(edgeStrength(forward), edgeStrength(reverse));
      if (!best || strength > best.strength) best = { pair, strength };
    }
  }
  return best?.pair ?? null;
}

function average(world: WorldState, refs: readonly ActorRef[], key: 'mood' | 'sociability' | 'thirst'): number {
  const ids = new Set(refs.map(visitorIdOf).filter((id): id is number => id !== null));
  const values = world.guests.filter((guest) => guest.visitorId !== undefined && ids.has(guest.visitorId))
    .map((guest) => guest[key]);
  return values.length === 0 ? 50 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function valuesFor(world: WorldState, from: ActorRef, to: ActorRef): InfluenceValues {
  const edge = relationshipBetween(world, from, to);
  return {
    mood: average(world, [from, to], 'mood'),
    sociability: average(world, [from, to], 'sociability'),
    thirst: average(world, [from, to], 'thirst'),
    rumor: 0,
    trust: edge?.trust ?? 0,
    sympathy: edge?.sympathy ?? 0,
    conflict: edge?.conflict ?? 0,
  };
}

/** Gewicht eines Pool-Events: Matrix, Grundgewicht und Wiederholungsdaempfung. */
export function poolEventWeight(
  world: WorldState, eventId: string, from: ActorRef, to: ActorRef,
  config: InfluenceConfig = INFLUENCE_CONFIG, tick = world.tick,
): number {
  const entry = config.eventPool.events[eventId];
  if (!entry) return 0;
  const since = tick - config.eventPool.recencyWindowTicks;
  const recent = world.narrative.events.filter((event) => event.eventId === eventId && event.updatedTick >= since).length;
  const score = influenceScore(entry.context, valuesFor(world, from, to), config);
  return entry.baseWeight * Math.max(config.eventPool.weightFloor, score)
    * config.eventPool.recencyPenalty ** recent;
}

function poolIds(config: InfluenceConfig): ReadonlySet<string> {
  return new Set(Object.keys(config.eventPool.events));
}

function lastPoolEvent(world: WorldState, config: InfluenceConfig): NarrativeEventInstance | null {
  const ids = poolIds(config);
  return world.narrative.events.filter((event) => ids.has(event.eventId))
    .reduce<NarrativeEventInstance | null>((last, event) => !last
      || event.updatedTick > last.updatedTick
      || (event.updatedTick === last.updatedTick && event.id > last.id) ? event : last, null);
}

function candidateFor(template: EventTemplate, pair: readonly [ActorRef, ActorRef]): EventCandidate {
  return {
    eventId: template.eventId,
    templateId: template.eventId,
    templateVersion: template.version,
    offeredChoiceIds: [...offerChoiceIds(template)],
    priority: template.priority,
    scope: template.scope,
    participants: [...pair],
    sourceFactId: POOL_SOURCE_FACT,
    expiresInTicks: template.expiresInTicks,
    cooldownTicks: template.cooldownTicks,
    maxOccurrences: template.maxOccurrences,
    step: template.initialStep,
  };
}

/**
 * Zieht hoechstens ein Pool-Event. Liefert null, wenn ein Event live ist, die
 * Idle-Pause laeuft oder die optionale Chance nicht trifft; die Funktion ist
 * damit nie triggerpflichtig und schreibt weder Journal noch `lastEvent`.
 */
export function maybeScheduleMainEvent(
  world: WorldState, config: InfluenceConfig = INFLUENCE_CONFIG, tick = world.tick,
): NarrativeEventInstance | null {
  validateInfluenceConfig(config);
  if (world.narrative.events.some((event) => isLiveEventStatus(event.status))) return null;
  const last = lastPoolEvent(world, config);
  if (last && tick - last.updatedTick < config.eventPool.idleCooldownTicks) return null;
  const chance = nextNarrativeRandom(world.narrative.rng);
  world.narrative.rng = chance.rng;
  if (chance.value >= config.eventPool.chance) return null;

  const pair = pairFor(world);
  if (!pair) return null;
  const options: { readonly eventId: string; readonly candidate: EventCandidate; readonly weight: number }[] = [];
  for (const eventId of Object.keys(config.eventPool.events)) {
    const template = templateFor(eventId);
    if (!template || template.triggerId !== ENGINE_POOL_TRIGGER) continue;
    const candidate = candidateFor(template, pair);
    if (!canScheduleEvent(world, candidate, tick)) continue;
    const weight = poolEventWeight(world, eventId, pair[0], pair[1], config, tick);
    if (weight > 0) options.push({ eventId, candidate, weight });
  }
  if (options.length === 0) return null;
  const lastId = last?.eventId ?? null;
  const withoutRepeat = config.eventPool.repeatLockout > 0 && options.length > 1
    ? options.filter((option) => option.eventId !== lastId) : options;
  const eligible = withoutRepeat.length > 0 ? withoutRepeat : options;
  const total = eligible.reduce((sum, option) => sum + option.weight, 0);
  if (!(total > 0)) return null;
  const draw = nextNarrativeRandom(world.narrative.rng);
  world.narrative.rng = draw.rng;
  let target = draw.value * total;
  let chosen = eligible[eligible.length - 1]!;
  for (const option of eligible) {
    target -= option.weight;
    if (target < 0) { chosen = option; break; }
  }
  return scheduleEvent(world, chosen.candidate, 'OFFERED', tick);
}
