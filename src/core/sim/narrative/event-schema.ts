/** Schema und sichere Normalisierung der persistenten Event-Domaene. */
import { isActorRef } from './relationships';
import {
  NARRATIVE_EVENT_SCOPES, NARRATIVE_EVENT_STATUSES,
  type EventCandidate, type NarrativeCooldown, type NarrativeEventInstance,
  type NarrativeEventScope, type NarrativeEventStatus, type NarrativeRngState,
} from './event-types';
import { createNarrativeRng, DEFAULT_NARRATIVE_SEED } from './narrative-rng';
import { isOfferedChoiceIds, normalizeOfferedChoiceIds } from './events/template-schema';
import { NARRATIVE_LIMITS } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isSafeInt = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isUint32 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const isScope = (value: unknown): value is NarrativeEventScope =>
  typeof value === 'string' && (NARRATIVE_EVENT_SCOPES as readonly string[]).includes(value);
const isStatus = (value: unknown): value is NarrativeEventStatus =>
  typeof value === 'string' && (NARRATIVE_EVENT_STATUSES as readonly string[]).includes(value);
const isStep = (value: unknown): value is string => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,31}$/.test(value);

function validParticipants(scope: NarrativeEventScope, raw: unknown): raw is readonly EventCandidate['participants'][number][] {
  if (!Array.isArray(raw) || !raw.every(isActorRef)) return false;
  const refs = raw as readonly string[];
  if (scope === 'GLOBAL') return refs.length === 0;
  if (scope === 'VISITOR') return refs.length === 1 && refs[0]!.startsWith('visitor:');
  if (scope === 'PAIR') return refs.length === 2 && refs[0] !== refs[1];
  return refs.length === 1 && refs[0]!.startsWith('rival:');
}

export function isEventCandidate(raw: unknown): raw is EventCandidate {
  if (!isRecord(raw) || !isText(raw.eventId, 64) || !isScope(raw.scope)
    || !validParticipants(raw.scope, raw.participants)) return false;
  if (!isSafeInt(raw.priority, 0, 1000) || !isSafeInt(raw.sourceFactId, 1)) return false;
  if (raw.expiresInTicks !== undefined && !isSafeInt(raw.expiresInTicks, 0)) return false;
  if (raw.cooldownTicks !== undefined && !isSafeInt(raw.cooldownTicks, 0)) return false;
  if (raw.maxOccurrences !== undefined && !isSafeInt(raw.maxOccurrences, 1)) return false;
  if (raw.step !== undefined && !isStep(raw.step)) return false;
  if (raw.templateId !== undefined && !isText(raw.templateId, 64)) return false;
  if (raw.templateVersion !== undefined && !isSafeInt(raw.templateVersion, 1, 1000)) return false;
  if (raw.offeredChoiceIds !== undefined && !isOfferedChoiceIds(raw.offeredChoiceIds)) return false;
  return raw.chainFromEventId === undefined || raw.chainFromEventId === null || isSafeInt(raw.chainFromEventId, 1);
}

export function isEventInstance(raw: unknown): raw is NarrativeEventInstance {
  if (!isRecord(raw) || !isSafeInt(raw.id, 1) || !isText(raw.eventId, 64)
    || !isStatus(raw.status) || !isScope(raw.scope) || !validParticipants(raw.scope, raw.participants)) return false;
  if (!isText(raw.templateId, 64) || !isSafeInt(raw.templateVersion, 1, 1000)
    || !isOfferedChoiceIds(raw.offeredChoiceIds)) return false;
  if (!isSafeInt(raw.sourceFactId, 1) || !isSafeInt(raw.priority, 0, 1000)) return false;
  if (!isSafeInt(raw.startedTick, 0) || !isSafeInt(raw.updatedTick, 0) || !isSafeInt(raw.expiresTick, 0)) return false;
  if (raw.updatedTick < raw.startedTick || raw.expiresTick < raw.startedTick) return false;
  if (!isStep(raw.step) || !isSafeInt(raw.maxOccurrences, 1) || !isSafeInt(raw.cooldownTicks, 0)) return false;
  if (raw.chainFromEventId !== null && !isSafeInt(raw.chainFromEventId, 1)) return false;
  return raw.resolution === null || isText(raw.resolution, 64);
}

function normalizeEvents(raw: unknown): NarrativeEventInstance[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<number, NarrativeEventInstance>();
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const templateId = isText(entry.templateId, 64) ? entry.templateId : entry.eventId;
    const templateVersion = isSafeInt(entry.templateVersion, 1, 1000) ? entry.templateVersion : 1;
    const offeredChoiceIds = normalizeOfferedChoiceIds(entry.offeredChoiceIds);
    const normalized = { ...entry, templateId, templateVersion, offeredChoiceIds };
    if (!isEventInstance(normalized) || byId.has(normalized.id)) continue;
    byId.set(normalized.id, {
      ...normalized,
      participants: [...normalized.participants],
      offeredChoiceIds: [...normalized.offeredChoiceIds],
    });
  }
  const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
  const live = sorted.filter((event) => event.status === 'OFFERED' || event.status === 'ACTIVE')
    .slice(-NARRATIVE_LIMITS.eventInstances);
  const historyLimit = Math.max(0, NARRATIVE_LIMITS.eventInstances - live.length);
  const history = historyLimit === 0 ? [] : sorted
    .filter((event) => event.status !== 'OFFERED' && event.status !== 'ACTIVE')
    .slice(-historyLimit);
  return [...live, ...history].sort((a, b) => a.id - b.id);
}

function normalizeCooldowns(raw: unknown): NarrativeCooldown[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, NarrativeCooldown>();
  for (const entry of raw) {
    if (!isRecord(entry) || !isText(entry.key, 200) || !isText(entry.eventId, 64)
      || !isSafeInt(entry.untilTick, 0) || !isSafeInt(entry.lastTick, 0)) continue;
    const previous = byKey.get(entry.key);
    if (!previous || entry.untilTick > previous.untilTick) {
      byKey.set(entry.key, {
        key: entry.key, eventId: entry.eventId, untilTick: entry.untilTick, lastTick: entry.lastTick,
      });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => a.untilTick - b.untilTick || a.key.localeCompare(b.key))
    .slice(-NARRATIVE_LIMITS.cooldowns);
}

function normalizeRng(raw: unknown): NarrativeRngState {
  if (!isRecord(raw)) return createNarrativeRng();
  const seed = isUint32(raw.seed) ? raw.seed : DEFAULT_NARRATIVE_SEED;
  return { seed, state: isUint32(raw.state) ? raw.state : seed };
}

interface NormalizedEventState {
  readonly eventSeq: number;
  readonly events: NarrativeEventInstance[];
  readonly cooldowns: NarrativeCooldown[];
  readonly rng: NarrativeRngState;
}

/** Fehlende alte Felder werden zu leeren Defaults; kaputte Eintraege werden verworfen. */
export function normalizeEventState(raw: unknown): NormalizedEventState {
  const source = isRecord(raw) ? raw : {};
  const events = normalizeEvents(source.events);
  const sequence = isSafeInt(source.eventSeq, 1) ? source.eventSeq : 1;
  const maxId = events.reduce((max, event) => Math.max(max, event.id), 0);
  return {
    eventSeq: Math.max(sequence, maxId + 1),
    events,
    cooldowns: normalizeCooldowns(source.cooldowns),
    rng: normalizeRng(source.rng),
  };
}
