/** Validierung und stabile Reihenfolge persistierter Narrative-Facts. */
import { RIVAL_IDS, type RivalId } from '../types-model';
import { isActorRef, isStaffRef, visitorIdOf } from './relationships';
import {
  HOUSE_BANDS, NARRATIVE_FACT_KINDS, VISITOR_VALENCES,
  type ActorRef, type HouseBand, type NarrativeFact, type VisitorValence,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const safeInteger = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value < Number.MAX_SAFE_INTEGER;

const isRivalId = (value: unknown): value is RivalId =>
  typeof value === 'string' && (RIVAL_IDS as readonly string[]).includes(value);

function actorRefs(raw: unknown, count: number): ActorRef[] | null {
  if (!Array.isArray(raw) || raw.length !== count || !raw.every(isActorRef)) return null;
  return raw;
}

function visitorRefs(raw: unknown): ActorRef[] | null {
  const refs = actorRefs(raw, 2);
  if (!refs || refs[0] === refs[1] || visitorIdOf(refs[0]!) === null || visitorIdOf(refs[1]!) === null) return null;
  return refs;
}

export function isFact(raw: unknown): raw is NarrativeFact {
  if (!isRecord(raw)) return false;
  const kind = raw.kind as NarrativeFact['kind'];
  if (!safeInteger(raw.id, 1) || !NARRATIVE_FACT_KINDS.includes(kind)) return false;
  if (!safeInteger(raw.tick, 0) || !safeInteger(raw.day, 0)) return false;
  if (kind === 'COMMAND_REJECTED') {
    return typeof raw.commandId === 'string' && /^[A-Za-z][A-Za-z0-9_:-]{0,63}$/.test(raw.commandId)
      && typeof raw.reason === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(raw.reason);
  }
  if (kind === 'EVENT_RESOLVED') {
    return safeInteger(raw.eventId, 1)
      && typeof raw.eventKind === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(raw.eventKind)
      && typeof raw.choiceId === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(raw.choiceId)
      && typeof raw.outcomeId === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(raw.outcomeId);
  }
  if (kind === 'HOUSE_BALANCE') {
    return Number.isSafeInteger(raw.balance) && HOUSE_BANDS.includes(raw.band as HouseBand);
  }
  if (kind === 'VISITOR_CONFLICT') {
    const refs = visitorRefs(raw.actorRefs);
    return refs !== null
      && (raw.initiator === refs[0] || raw.initiator === refs[1])
      && (raw.severity === 1 || raw.severity === 2);
  }
  if (kind === 'VISITOR_SERVICE') {
    const refs = actorRefs(raw.actorRefs, 2);
    return refs !== null && refs[0] !== refs[1]
      && refs.some((ref) => visitorIdOf(ref) !== null)
      && refs.some(isStaffRef)
      && raw.service === 'CASHIER'
      && VISITOR_VALENCES.includes(raw.valence as VisitorValence);
  }
  if (kind === 'RIVAL_ENCOUNTER') {
    const refs = actorRefs(raw.actorRefs, 2);
    return isRivalId(raw.rivalId)
      && refs !== null && refs[0] === `rival:${raw.rivalId}` && refs[1] === 'player'
      && Number.isSafeInteger(raw.netToHouse);
  }
  if (!safeInteger(raw.visitorId, 1)) return false;
  if (kind === 'START_POOL') return safeInteger(raw.capital, 0);
  if (kind === 'VISITOR_FIRST_SEEN') {
    return typeof raw.persona === 'string' && ['LUMPEN', 'STREET', 'BUSINESS', 'HIGH_ROLLER', 'STAMMGAST'].includes(raw.persona);
  }
  if (kind === 'VISITOR_RETURNED') return safeInteger(raw.visits, 1);
  return safeInteger(raw.guestId, 1) && VISITOR_VALENCES.includes(raw.valence as VisitorValence)
    && typeof raw.score === 'number' && Number.isFinite(raw.score) && raw.score >= 0 && raw.score <= 100;
}

/** Entfernt Duplikate, sortiert nach ID und akzeptiert nur schema-konforme Facts. */
export function orderedFacts(raw: unknown): NarrativeFact[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<number, NarrativeFact>();
  for (const fact of raw) {
    if (isFact(fact) && !byId.has(fact.id)) byId.set(fact.id, fact);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
