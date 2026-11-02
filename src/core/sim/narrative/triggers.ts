/** Deklarative Bedingungen fuer Narrative-Facts; Evaluation liest nur Welt und Ledger. */
import type { Ledger } from '../../economy/ledger';
import { HAUSKONTO } from '../money';
import type { WorldState } from '../types';
import type { NarrativeFact, VisitorValence } from './types';

export type TriggerCondition =
  | { readonly op: 'all'; readonly conditions: readonly TriggerCondition[] }
  | { readonly op: 'any'; readonly conditions: readonly TriggerCondition[] }
  | { readonly op: 'not'; readonly condition: TriggerCondition }
  | { readonly op: 'fact'; readonly kind: NarrativeFact['kind'] }
  | { readonly op: 'visitor-memory'; readonly valence: VisitorValence }
  | { readonly op: 'house-at-most'; readonly amount: number }
  | { readonly op: 'damaged-device' }
  | { readonly op: 'charisma-at-least'; readonly level: number }
  | { readonly op: 'flag-at-least'; readonly flag: string; readonly value: number }
  | { readonly op: 'fact-within'; readonly ticks: number };

/** Fehlende Besucher oder ungueltige Grenzen ergeben keinen Treffer. */
export function evaluateTrigger(condition: TriggerCondition, world: WorldState, ledger: Ledger, fact: NarrativeFact): boolean {
  switch (condition.op) {
    case 'all': return condition.conditions.length > 0 && condition.conditions.every((child) => evaluateTrigger(child, world, ledger, fact));
    case 'any': return condition.conditions.some((child) => evaluateTrigger(child, world, ledger, fact));
    case 'not': return !evaluateTrigger(condition.condition, world, ledger, fact);
    case 'fact': return fact.kind === condition.kind;
    case 'visitor-memory': return world.visitors.find((visitor) => visitor.id === fact.visitorId)?.memories?.some((memory) => memory.valence === condition.valence) ?? false;
    case 'house-at-most': return Number.isSafeInteger(condition.amount) && condition.amount >= 0 && ledger.getBalance(HAUSKONTO) <= condition.amount;
    case 'damaged-device': return world.furniture.some((item) => Boolean(item.gameId) && item.damaged);
    case 'charisma-at-least': return Number.isSafeInteger(condition.level) && condition.level >= 0 && world.player.rpg.charismaLevel >= condition.level;
    case 'flag-at-least': return Number.isFinite(condition.value) && Object.hasOwn(world.narrative.flags, condition.flag) && world.narrative.flags[condition.flag]! >= condition.value;
    case 'fact-within': return Number.isSafeInteger(condition.ticks) && condition.ticks >= 0 && fact.tick <= world.tick && world.tick - fact.tick <= condition.ticks;
  }
}
