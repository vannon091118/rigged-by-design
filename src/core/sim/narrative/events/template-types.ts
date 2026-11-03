/** Deklarative Event-Templates und Choice-Vertraege; Darstellung bleibt ausserhalb. */
import type { NarrativeEventScope } from '../event-types';
import type { ActorRole, RelationshipDimension } from '../trigger-types';
import type { ActorRef, RelationshipEdge } from '../types';

/** Harte Grenzen fuer kompilierte Templates und persistierte Choice-Saetze. */
export const EVENT_TEMPLATE_LIMITS = {
  choices: 8,
  contentSlots: 12,
  offeredChoices: 8,
  requirements: 6,
  effects: 6,
  costs: 4,
  requirementDepth: 4,
} as const;

export type ContentSlotKind = 'TITLE' | 'BODY' | 'CHOICE_LABEL' | 'OUTCOME';

export interface ContentSlot {
  readonly id: string;
  readonly kind: ContentSlotKind;
}

/** Ein Akteur ist entweder fest im Template oder ein aufgeloester Teilnehmer. */
export type ChoiceActor = ActorRef | { readonly participant: number };

export type ChoiceRequirement =
  | { readonly op: 'all'; readonly requirements: readonly ChoiceRequirement[] }
  | { readonly op: 'event-step'; readonly step: string }
  | { readonly op: 'flag-at-least'; readonly flag: string; readonly value: number }
  | { readonly op: 'flag-present'; readonly flag: string }
  | { readonly op: 'house-at-least'; readonly amount: number }
  | {
    readonly op: 'relationship-at-least';
    readonly from: ChoiceActor;
    readonly to: ChoiceActor;
    readonly dimension: RelationshipDimension;
    readonly value: number;
  };

export type ChoiceCost = { readonly kind: 'VACOIN'; readonly amount: number };

export type ChoiceEffect =
  | { readonly kind: 'SET_FLAG'; readonly flag: string; readonly delta: number }
  | {
    readonly kind: 'ADJUST_RELATIONSHIP';
    readonly from: ChoiceActor;
    readonly to: ChoiceActor;
    readonly dimension: RelationshipDimension;
    readonly delta: number;
  };

export interface EventChoice {
  readonly choiceId: string;
  /** Verweist auf einen CHOICE_LABEL-Slot; Text bleibt ausserhalb des Vertrags. */
  readonly labelSlotId: string;
  readonly requirements: readonly ChoiceRequirement[];
  readonly costs: readonly ChoiceCost[];
  readonly effects: readonly ChoiceEffect[];
  readonly outcomeId: string;
  readonly followUpEventId: string | null;
}

export interface EventTemplate {
  readonly eventId: string;
  readonly version: number;
  readonly triggerId: string;
  readonly priority: number;
  readonly scope: NarrativeEventScope;
  readonly participantRoles: readonly ActorRole[];
  readonly contentSlots: readonly ContentSlot[];
  readonly choices: readonly EventChoice[];
  readonly initialStep: string;
  readonly expiresInTicks: number;
  readonly cooldownTicks: number;
  readonly maxOccurrences: number;
}

/** Nur Leseansicht fuer die reine Choice-Pruefung; enthaelt keine Weltmutation. */
export interface ChoiceContext {
  readonly tick: number;
  readonly flags: Readonly<Record<string, number>>;
  readonly houseBalance: number;
  readonly relationships: readonly RelationshipEdge[];
  readonly participants: readonly ActorRef[];
}

export type ChoiceBlockReason =
  | 'EVENT_NOT_LIVE'
  | 'EVENT_EXPIRED'
  | 'TEMPLATE_MISMATCH'
  | 'CHOICE_NOT_OFFERED'
  | 'REQUIREMENT_NOT_MET'
  | 'INSUFFICIENT_FUNDS';

export interface ChoiceEvaluation {
  readonly choiceId: string;
  readonly choice: EventChoice | null;
  readonly available: boolean;
  readonly reasons: readonly ChoiceBlockReason[];
}
