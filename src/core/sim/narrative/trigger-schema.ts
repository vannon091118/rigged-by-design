/** Schema-Validierung fuer persistierbare Trigger-Definitionen; fail-closed. */
import { RIVAL_ACTION_IDS, type RivalActionId } from '../rival-ai/types';
import { isActorRef } from './relationships';
import {
  HOUSE_BANDS, NARRATIVE_FACT_KINDS, VISITOR_VALENCES,
  type NarrativeFact, type VisitorValence,
} from './types';
import type {
  ActorRole, DemandTier, RelationshipDimension, TriggerCondition, TriggerDefinition,
} from './trigger-types';

const DEMAND_TIERS: readonly DemandTier[] = ['BUDE', 'KASSE', 'SAAL', 'KONZERN'];
const ACTOR_ROLES: readonly ActorRole[] = ['visitor', 'staff', 'rival', 'player'];
const DIMENSIONS: readonly RelationshipDimension[] = ['trust', 'sympathy', 'conflict', 'influence'];
const MAX_NODES = 64;
const MAX_DEPTH = 12;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isSafeInt = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isFactKind = (value: unknown): value is NarrativeFact['kind'] =>
  typeof value === 'string' && (NARRATIVE_FACT_KINDS as readonly string[]).includes(value);
const isRivalAction = (value: unknown): value is RivalActionId =>
  typeof value === 'string' && (RIVAL_ACTION_IDS as readonly string[]).includes(value);
const isValence = (value: unknown): value is VisitorValence =>
  typeof value === 'string' && (VISITOR_VALENCES as readonly string[]).includes(value);
const isDemandTier = (value: unknown): value is DemandTier =>
  typeof value === 'string' && (DEMAND_TIERS as readonly string[]).includes(value);
const isActorRole = (value: unknown): value is ActorRole =>
  typeof value === 'string' && (ACTOR_ROLES as readonly string[]).includes(value);
const isDimension = (value: unknown): value is RelationshipDimension =>
  typeof value === 'string' && (DIMENSIONS as readonly string[]).includes(value);
const isFlag = (value: unknown): value is string => isText(value, 64);

type Budget = { count: number };

function validCondition(raw: unknown, depth: number, budget: Budget): boolean {
  if (depth > MAX_DEPTH || !isRecord(raw)) return false;
  budget.count += 1;
  if (budget.count > MAX_NODES || typeof raw.op !== 'string') return false;
  switch (raw.op) {
    case 'all':
    case 'any':
      return Array.isArray(raw.conditions) && raw.conditions.length > 0
        && raw.conditions.every((child) => validCondition(child, depth + 1, budget));
    case 'not':
      return validCondition(raw.condition, depth + 1, budget);
    case 'fact':
      return isFactKind(raw.kind);
    case 'rival-action':
      return Array.isArray(raw.actions) && raw.actions.length > 0
        && raw.actions.length <= RIVAL_ACTION_IDS.length
        && new Set(raw.actions).size === raw.actions.length
        && raw.actions.every(isRivalAction);
    case 'visitor-memory':
      return isValence(raw.valence);
    case 'house-at-most':
    case 'house-at-least':
      return isSafeInt(raw.amount, 0);
    case 'house-band':
      return typeof raw.band === 'string' && (HOUSE_BANDS as readonly string[]).includes(raw.band);
    case 'damaged-device':
      return true;
    case 'charisma-at-least':
      return isSafeInt(raw.level, 0);
    case 'reputation-at-least':
      return isSafeInt(raw.value, 0, 100);
    case 'demand-tier-at-least':
      return isDemandTier(raw.tier);
    case 'guests-served-at-least':
      return isSafeInt(raw.count, 0);
    case 'flag-at-least':
      return isFlag(raw.flag) && Number.isFinite(raw.value);
    case 'flag-present':
    case 'flag-absent':
      return isFlag(raw.flag);
    case 'fact-within':
      return isSafeInt(raw.ticks, 0);
    case 'recent-fact':
      return isFactKind(raw.kind)
        && (raw.ticks === undefined || isSafeInt(raw.ticks, 0))
        && (raw.minCount === undefined || isSafeInt(raw.minCount, 1));
    case 'actor-is':
      return isActorRef(raw.ref);
    case 'actor-role':
      return isActorRole(raw.role);
    case 'relationship-at-least':
    case 'relationship-at-most':
      return isActorRef(raw.from) && isActorRef(raw.to) && raw.from !== raw.to
        && isDimension(raw.dimension) && isSafeInt(raw.value, -10, 10);
    default:
      return false;
  }
}

export function isTriggerCondition(raw: unknown): raw is TriggerCondition {
  return validCondition(raw, 0, { count: 0 });
}

export function isTriggerDefinition(raw: unknown): raw is TriggerDefinition {
  if (!isRecord(raw) || !isText(raw.id, 64)) return false;
  return isTriggerCondition(raw.condition);
}

/** Kopiert nur validierte Daten; unbekannte oder manipulierte Definitionen werden verworfen. */
export function normalizeTriggerDefinition(raw: unknown): TriggerDefinition | null {
  if (!isTriggerDefinition(raw)) return null;
  return { id: raw.id, condition: raw.condition };
}

