/** Deklarative Trigger-Vertraege: Bedingungen, Context und erklaerte Treffer. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { RivalActionId } from '../rival-ai/types';
import type { DemandTier } from '../types';
import type {
  ActorRef, HouseBand, NarrativeFact, RelationshipEdge, Visitor, VisitorValence,
} from './types';

export type ActorRole = 'visitor' | 'staff' | 'rival' | 'player';
export type RelationshipDimension = 'trust' | 'sympathy' | 'conflict' | 'influence';

/**
 * Alle Bedingungen lesen nur den Context. `fact` ist der aktuelle Ausloeser;
 * `facts` enthaelt ihn plus die begrenzte Kurzzeithistorie.
 */
export type TriggerCondition =
  | { readonly op: 'all'; readonly conditions: readonly TriggerCondition[] }
  | { readonly op: 'any'; readonly conditions: readonly TriggerCondition[] }
  | { readonly op: 'not'; readonly condition: TriggerCondition }
  | { readonly op: 'fact'; readonly kind: NarrativeFact['kind'] }
  | { readonly op: 'rival-action'; readonly actions: readonly RivalActionId[] }
  | { readonly op: 'visitor-memory'; readonly valence: VisitorValence }
  | { readonly op: 'house-at-most'; readonly amount: number }
  | { readonly op: 'house-at-least'; readonly amount: number }
  | { readonly op: 'house-band'; readonly band: HouseBand }
  | { readonly op: 'damaged-device' }
  | { readonly op: 'charisma-at-least'; readonly level: number }
  | { readonly op: 'reputation-at-least'; readonly value: number }
  | { readonly op: 'demand-tier-at-least'; readonly tier: DemandTier }
  | { readonly op: 'guests-served-at-least'; readonly count: number }
  | { readonly op: 'flag-at-least'; readonly flag: string; readonly value: number }
  | { readonly op: 'flag-present'; readonly flag: string }
  | { readonly op: 'flag-absent'; readonly flag: string }
  | { readonly op: 'fact-within'; readonly ticks: number }
  | {
    readonly op: 'recent-fact';
    readonly kind: NarrativeFact['kind'];
    readonly ticks?: number;
    readonly minCount?: number;
  }
  | { readonly op: 'actor-is'; readonly ref: ActorRef }
  | { readonly op: 'actor-role'; readonly role: ActorRole }
  | {
    readonly op: 'relationship-at-least' | 'relationship-at-most';
    readonly from: ActorRef;
    readonly to: ActorRef;
    readonly dimension: RelationshipDimension;
    readonly value: number;
  };

/** Der Context ist eine reine Leseansicht; der Evaluator veraendert ihn nie. */
export interface TriggerContext {
  readonly fact: NarrativeFact;
  readonly facts: readonly NarrativeFact[];
  readonly tick: number;
  readonly day: number;
  readonly flags: Readonly<Record<string, number>>;
  readonly relationships: readonly RelationshipEdge[];
  readonly visitors: readonly Visitor[];
  readonly houseBalance: VaCoinMicro;
  readonly houseBand: HouseBand;
  readonly charismaLevel: number;
  readonly reputation: number;
  readonly demandTier: DemandTier;
  readonly guestsServed: number;
  readonly damagedDevice: boolean;
}

export interface TriggerDefinition {
  readonly id: string;
  readonly condition: TriggerCondition;
}

export interface ConditionResult {
  readonly matched: boolean;
  readonly reasons: readonly string[];
}

export interface TriggerMatch {
  readonly triggerId: string;
  readonly matched: boolean;
  readonly factId: number;
  readonly participants: readonly ActorRef[];
  readonly reasons: readonly string[];
}
