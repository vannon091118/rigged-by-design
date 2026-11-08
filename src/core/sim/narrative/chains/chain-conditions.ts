/** Reine Auswertung der Kettenbedingungen; keine Welt-, Ledger- oder RNG-Mutation. */
import { evaluateInfluence } from '../../influence';
import type { ChoiceActor } from '../events/template-types';
import type { ActorRef } from '../types';
import type { ChainCondition, ChainConditionResult, ChainContext } from './chain-types';

const result = (matched: boolean, reason: string): ChainConditionResult => ({ matched, reasons: [reason] });

function actorOf(actor: ChoiceActor | undefined, context: ChainContext): ActorRef | null {
  if (actor === undefined) return context.participants[0] ?? null;
  return typeof actor === 'string' ? actor : context.participants[actor.participant] ?? null;
}

function within(tick: number, context: ChainContext, ticks: number): boolean {
  return Number.isSafeInteger(ticks) && ticks >= 0 && tick <= context.tick && context.tick - tick <= ticks;
}

function inRange(value: number, min: number | undefined, max: number | undefined): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

function relationshipValue(condition: Extract<ChainCondition, { op: 'relationship-between' }>, context: ChainContext): number {
  const from = actorOf(condition.from, context);
  const to = actorOf(condition.to, context);
  if (from === null || to === null) return Number.NaN;
  const edge = context.relationships.find((entry) => entry.from === from && entry.to === to);
  if (!edge) return 0;
  // Eine noch nie geschriebene Kante ist neutral, nicht automatisch ein Treffer.
  if (condition.dimension === 'trust') return edge.trust;
  if (condition.dimension === 'sympathy') return edge.sympathy;
  if (condition.dimension === 'conflict') return edge.conflict;
  return edge.influence;
}

/**
 * Jede Bedingung liest ausschliesslich den Context. Eine unbekannte Matrix-
 * Kontext-ID ist ein Config-Fehler und wird fail-closed als Nichttreffer
 * behandelt, statt den Lauf mit einer Ausnahme abzubrechen.
 */
export function evaluateChainCondition(condition: ChainCondition, context: ChainContext): ChainConditionResult {
  switch (condition.op) {
    case 'all': {
      if (condition.conditions.length === 0) return result(false, 'all:leer');
      const children = condition.conditions.map((child) => evaluateChainCondition(child, context));
      return {
        matched: children.every((child) => child.matched),
        reasons: children.flatMap((child) => child.reasons),
      };
    }
    case 'any': {
      if (condition.conditions.length === 0) return result(false, 'any:leer');
      const children = condition.conditions.map((child) => evaluateChainCondition(child, context));
      return {
        matched: children.some((child) => child.matched),
        reasons: children.flatMap((child) => child.reasons),
      };
    }
    case 'not': {
      const child = evaluateChainCondition(condition.condition, context);
      return { matched: !child.matched, reasons: [`not(${child.reasons.join('|')})`] };
    }
    case 'flag-between': {
      const value = context.flags[condition.flag] ?? 0;
      return result(inRange(value, condition.min, condition.max), `flag:${condition.flag}=${value}`);
    }
    case 'flag-present': return result(Object.hasOwn(context.flags, condition.flag), `flag:${condition.flag}:present`);
    case 'flag-absent': return result(!Object.hasOwn(context.flags, condition.flag), `flag:${condition.flag}:absent`);
    case 'relationship-between': {
      const value = relationshipValue(condition, context);
      return result(Number.isFinite(value) && inRange(value, condition.min, condition.max),
        `relationship:${condition.dimension}=${value}`);
    }
    case 'house-between':
      return result(inRange(context.houseBalance, condition.min, condition.max), `house=${context.houseBalance}`);
    case 'reputation-between':
      return result(inRange(context.reputation, condition.min, condition.max), `reputation=${context.reputation}`);
    case 'influence-between': {
      const actor = actorOf(condition.actor, context);
      const values = actor === null ? null : context.influenceByActor.get(actor) ?? null;
      if (!values) return result(false, `influence:${condition.context}:kein-akteur`);
      try {
        const score = evaluateInfluence(condition.context, values, context.influenceConfig).score;
        return result(inRange(score, condition.min, condition.max), `influence:${condition.context}=${score.toFixed(3)}`);
      } catch {
        return result(false, `influence:${condition.context}:unbekannter-kontext`);
      }
    }
    case 'knowledge': {
      const actor = actorOf(condition.actor, context);
      const known = actor !== null && context.knowledge.some((entry) => entry.actor === actor
        && entry.topic === condition.topic && entry.confidence >= condition.minConfidence
        && (condition.sourceKind === undefined || entry.sourceKind === condition.sourceKind));
      return result(known, `knowledge:${condition.topic}:${actor ?? 'kein-akteur'}`);
    }
    case 'fact-count': {
      const count = context.recent.filter((fact) => fact.kind === condition.kind
        && (condition.ticks === undefined || within(fact.tick, context, condition.ticks))).length;
      return result(count >= condition.minCount, `facts:${condition.kind}=${count}`);
    }
    case 'event-resolved': {
      const found = context.events.some((event) => event.status === 'RESOLVED'
        && event.eventId === condition.eventId
        && (condition.outcomeId === undefined || event.resolution === condition.outcomeId)
        && (condition.ticks === undefined || within(event.updatedTick, context, condition.ticks)));
      return result(found, `event:${condition.eventId}:${condition.outcomeId ?? '*'}`);
    }
    case 'chain-visited': {
      const count = context.visits[condition.nodeId] ?? 0;
      return result(count >= condition.minCount, `visited:${condition.nodeId}=${count}`);
    }
    case 'tick-between':
      return result(inRange(context.tick, condition.min, condition.max), `tick=${context.tick}`);
    case 'day-between':
      return result(inRange(context.day, condition.min, condition.max), `day=${context.day}`);
  }
}
