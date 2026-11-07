/** Persistente Event-Vertraege fuer Scheduler, Lifecycle und Ereignisketten. */
import type { ActorRef } from './types';

export type NarrativeEventStatus = 'ELIGIBLE' | 'OFFERED' | 'ACTIVE' | 'RESOLVED' | 'EXPIRED' | 'CANCELLED';
export type NarrativeEventScope = 'GLOBAL' | 'VISITOR' | 'PAIR' | 'RIVAL';

export const NARRATIVE_EVENT_STATUSES: readonly NarrativeEventStatus[] = [
  'ELIGIBLE', 'OFFERED', 'ACTIVE', 'RESOLVED', 'EXPIRED', 'CANCELLED',
];
export const NARRATIVE_EVENT_SCOPES: readonly NarrativeEventScope[] = ['GLOBAL', 'VISITOR', 'PAIR', 'RIVAL'];

/** Eine persistierte Event-Instanz; IDs sind monoton und werden nie wiederverwendet. */
export interface NarrativeEventInstance {
  readonly id: number;
  readonly eventId: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly offeredChoiceIds: readonly string[];
  readonly status: NarrativeEventStatus;
  readonly scope: NarrativeEventScope;
  readonly participants: readonly ActorRef[];
  readonly sourceFactId: number;
  readonly priority: number;
  readonly startedTick: number;
  readonly updatedTick: number;
  readonly expiresTick: number;
  readonly step: string;
  /** 0 heisst: unbegrenzt; der Cooldown reguliert dann den Abstand. */
  readonly maxOccurrences: number;
  readonly cooldownTicks: number;
  readonly chainFromEventId: number | null;
  readonly resolution: string | null;
}

/** Cooldown gilt pro Event und Teilnehmerkombination, nicht global fuer eine Event-ID. */
export interface NarrativeCooldown {
  readonly key: string;
  readonly eventId: string;
  readonly untilTick: number;
  readonly lastTick: number;
}

/** Eigener, persistenter Strom; der Gameplay-PRNG bleibt unberuehrt. */
export interface NarrativeRngState {
  readonly seed: number;
  readonly state: number;
}

/** Ein Kandidat kommt aus einem Trigger-Match; der Scheduler entscheidet ueber die Instanz. */
export interface EventCandidate {
  readonly eventId: string;
  readonly templateId?: string;
  readonly templateVersion?: number;
  readonly offeredChoiceIds?: readonly string[];
  readonly priority: number;
  readonly scope: NarrativeEventScope;
  readonly participants: readonly ActorRef[];
  readonly sourceFactId: number;
  readonly expiresInTicks?: number;
  readonly cooldownTicks?: number;
  /** 0 heisst: unbegrenzt; fehlt der Wert, gilt genau eine Wiederholung. */
  readonly maxOccurrences?: number;
  readonly chainFromEventId?: number | null;
  readonly step?: string;
}
