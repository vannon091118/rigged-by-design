/** Reine Auswertung von Trigger-Bedingungen; keine Welt-, Ledger- oder RNG-Mutation. */
import { visitorIdOf } from './relationships';
import type {
  ActorRef, DemandTier, TriggerCondition, TriggerContext, TriggerDefinition, TriggerMatch,
  ConditionResult,
} from './trigger-types';
import { actorRefsOfFact } from './trigger-context';

const DEMAND_TIERS: readonly DemandTier[] = ['BUDE', 'KASSE', 'SAAL', 'KONZERN'];

const result = (matched: boolean, reason: string): ConditionResult => ({ matched, reasons: [reason] });

function visitorOfFact(context: TriggerContext) {
  const direct = 'visitorId' in context.fact ? context.fact.visitorId : null;
  const fromActor = actorRefsOfFact(context.fact)
    .map((ref) => visitorIdOf(ref))
    .find((id): id is number => id !== null) ?? null;
  const id = direct ?? fromActor;
  return id === null ? null : context.visitors.find((visitor) => visitor.id === id) ?? null;
}

function actorRole(ref: ActorRef): 'visitor' | 'staff' | 'rival' | 'player' {
  if (ref === 'player') return 'player';
  if (ref.startsWith('visitor:')) return 'visitor';
  if (ref.startsWith('staff:')) return 'staff';
  return 'rival';
}

function withinTick(tick: number, context: TriggerContext, ticks: number): boolean {
  return Number.isSafeInteger(ticks) && ticks >= 0 && tick <= context.tick && context.tick - tick <= ticks;
}

function relationshipValue(condition: Extract<TriggerCondition, { op: 'relationship-at-least' | 'relationship-at-most' }>, context: TriggerContext) {
  const edge = context.relationships.find((entry) => entry.from === condition.from && entry.to === condition.to);
  if (!edge) return null;
  return edge[condition.dimension];
}

/** Eine Bedingung liefert neben dem Match auch die konkreten Gruende fuer den Treffer. */
export function evaluateTrigger(condition: TriggerCondition, context: TriggerContext): ConditionResult {
  switch (condition.op) {
    case 'all': {
      if (condition.conditions.length === 0) return result(false, 'all:leer');
      const children = condition.conditions.map((child) => evaluateTrigger(child, context));
      const matched = children.every((child) => child.matched);
      return { matched, reasons: (matched ? children : children.filter((child) => !child.matched)).flatMap((child) => child.reasons) };
    }
    case 'any': {
      if (condition.conditions.length === 0) return result(false, 'any:leer');
      const children = condition.conditions.map((child) => evaluateTrigger(child, context));
      const matched = children.some((child) => child.matched);
      return { matched, reasons: (matched ? children.filter((child) => child.matched) : children).flatMap((child) => child.reasons) };
    }
    case 'not': {
      const child = evaluateTrigger(condition.condition, context);
      return { matched: !child.matched, reasons: [`not(${child.reasons.join(' | ')})`] };
    }
    case 'fact': return result(context.fact.kind === condition.kind, `fact:${condition.kind}`);
    case 'rival-action': {
      const action = context.fact.kind === 'RIVAL_ACTION' ? context.fact.action : null;
      return result(action !== null && condition.actions.includes(action), `rival-action:${action ?? 'kein-rival-action-fact'}`);
    }
    case 'visitor-memory': {
      const visitor = visitorOfFact(context);
      const matched = visitor?.memories?.some((memory) => memory.valence === condition.valence) ?? false;
      return result(matched, `memory:${condition.valence}`);
    }
    case 'house-at-most':
      return result(Number.isSafeInteger(condition.amount) && condition.amount >= 0 && context.houseBalance <= condition.amount, `house<=${condition.amount}`);
    case 'house-at-least':
      return result(Number.isSafeInteger(condition.amount) && condition.amount >= 0 && context.houseBalance >= condition.amount, `house>=${condition.amount}`);
    case 'house-band': return result(context.houseBand === condition.band, `house-band:${condition.band}`);
    case 'damaged-device': return result(context.damagedDevice, 'damaged-device');
    case 'charisma-at-least':
      return result(Number.isSafeInteger(condition.level) && condition.level >= 0 && context.charismaLevel >= condition.level, `charisma>=${condition.level}`);
    case 'reputation-at-least':
      return result(Number.isSafeInteger(condition.value) && condition.value >= 0 && condition.value <= 100 && context.reputation >= condition.value, `reputation>=${condition.value}`);
    case 'demand-tier-at-least': {
      const rank = DEMAND_TIERS.indexOf(condition.tier);
      return result(rank >= 0 && DEMAND_TIERS.indexOf(context.demandTier) >= rank, `demand-tier>=${condition.tier}`);
    }
    case 'guests-served-at-least':
      return result(Number.isSafeInteger(condition.count) && condition.count >= 0 && context.guestsServed >= condition.count, `guests-served>=${condition.count}`);
    case 'flag-at-least':
      return result(Number.isFinite(condition.value) && Object.hasOwn(context.flags, condition.flag) && context.flags[condition.flag]! >= condition.value, `flag:${condition.flag}>=${condition.value}`);
    case 'flag-present': return result(Object.hasOwn(context.flags, condition.flag), `flag:${condition.flag}:present`);
    case 'flag-absent': return result(!Object.hasOwn(context.flags, condition.flag), `flag:${condition.flag}:absent`);
    case 'fact-within': return result(withinTick(context.fact.tick, context, condition.ticks), `fact-within:${condition.ticks}`);
    case 'recent-fact': {
      const ticks = condition.ticks;
      const count = context.facts.filter((fact) => fact.kind === condition.kind
        && (ticks === undefined || withinTick(fact.tick, context, ticks))).length;
      return result(count >= (condition.minCount ?? 1), `recent:${condition.kind}:${count}`);
    }
    case 'actor-is': return result(actorRefsOfFact(context.fact).includes(condition.ref), `actor:${condition.ref}`);
    case 'actor-role': return result(actorRefsOfFact(context.fact).some((ref) => actorRole(ref) === condition.role), `actor-role:${condition.role}`);
    case 'relationship-at-least':
    case 'relationship-at-most': {
      const value = relationshipValue(condition, context);
      const matched = value !== null && (condition.op === 'relationship-at-least' ? value >= condition.value : value <= condition.value);
      return result(matched, `relationship:${condition.from}>${condition.to}:${condition.dimension}:${value ?? 'missing'}`);
    }
  }
}

/** Fuehrt Definition und Context zusammen und liefert Teilnehmer plus Begruendung. */
export function evaluateTriggerDefinition(definition: TriggerDefinition, context: TriggerContext): TriggerMatch {
  const evaluated = evaluateTrigger(definition.condition, context);
  return {
    triggerId: definition.id,
    matched: evaluated.matched,
    factId: context.fact.id,
    participants: actorRefsOfFact(context.fact),
    reasons: evaluated.reasons,
  };
}
