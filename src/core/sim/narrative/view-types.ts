/** NAR-14: Datenvertraege des Anzeigemodells; der Builder lebt in `view.ts`. */
import type { RivalActionRecord, RivalEvidence, RivalStance } from '../rival-ai/types';
import type { ActorRef, RivalId } from '../types';
import type { ChoiceBlockReason } from './events/template-types';
import type { NarrativeEventStatus } from './event-types';
import type { VisitorMemory } from './types';

interface NarrativeChoiceView {
  readonly choiceId: string;
  readonly label: string;
  readonly available: boolean;
  readonly reasons: readonly ChoiceBlockReason[];
  readonly cost: number;
}

interface NarrativeParticipantView {
  readonly ref: ActorRef;
  readonly label: string;
  readonly visitorId: number | null;
}

export interface NarrativeEventView {
  readonly id: number;
  readonly eventId: string;
  readonly title: string;
  readonly body: string;
  readonly step: string;
  readonly status: NarrativeEventStatus;
  readonly expiresInTicks: number;
  readonly participants: readonly NarrativeParticipantView[];
  readonly choices: readonly NarrativeChoiceView[];
  /** Slot-IDs, die auf die neutrale Sicherheitscopy zurueckfallen; leer heisst vollstaendig. */
  readonly fallbackSlots: readonly string[];
}

interface NarrativeRelationshipView {
  readonly to: ActorRef;
  readonly trust: number;
  readonly sympathy: number;
  readonly conflict: number;
  readonly influence: number;
  readonly updatedTick: number;
}

export interface NarrativeHistoryView {
  readonly id: number;
  readonly eventId: string;
  readonly title: string;
  readonly step: string;
  readonly status: NarrativeEventStatus;
  /** Tick des Abschlusses, nicht des Starts. */
  readonly tick: number;
  readonly resolution: string | null;
  readonly participants: readonly string[];
}

export interface NarrativeProfileView {
  readonly visitorId: number;
  readonly name: string;
  readonly persona: string;
  readonly visits: number;
  readonly memories: readonly VisitorMemory[];
  readonly relationships: readonly NarrativeRelationshipView[];
  readonly stories: readonly string[];
}

export interface NarrativeRivalView {
  readonly rivalId: RivalId;
  readonly stance: RivalStance;
  readonly capacity: number;
  readonly goodwill: number;
  /** true, solange die D2-Gegenmassnahme diesen Rivalen stillhaelt. */
  readonly countered: boolean;
  readonly counteredTicksLeft: number;
  readonly nextActionTick: number;
  readonly evidence: readonly RivalEvidence[];
  readonly history: readonly RivalActionRecord[];
}

export interface NarrativeView {
  readonly events: readonly NarrativeEventView[];
  /** Abgeschlossene Szenen, neueste zuerst; nur die jüngsten bleiben sichtbar. */
  readonly history: readonly NarrativeHistoryView[];
  readonly profiles: readonly NarrativeProfileView[];
  /** Eine Karte je Rivale in kanonischer Reihenfolge; reine Ableitung aus den Minds. */
  readonly rivals: readonly NarrativeRivalView[];
}
