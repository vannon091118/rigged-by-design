/** Narrative Datenvertraege: Facts, Erinnerungen und persistenter Zustand als reine JSON-Daten. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { PersonaId } from '../types';

type NarrativeFactKind = 'START_POOL' | 'VISITOR_FIRST_SEEN' | 'VISITOR_RETURNED' | 'VISIT_ENDED';
export type VisitorValence = 'GOOD' | 'NEUTRAL' | 'BAD';

export const NARRATIVE_FACT_KINDS: readonly NarrativeFactKind[] = [
  'START_POOL', 'VISITOR_FIRST_SEEN', 'VISITOR_RETURNED', 'VISIT_ENDED',
];
export const VISITOR_VALENCES: readonly VisitorValence[] = ['GOOD', 'NEUTRAL', 'BAD'];

/** Begrenzungen: Facts, Historie und Erinnerungen wachsen nicht unkontrolliert. */
export const NARRATIVE_LIMITS = { pending: 48, recent: 120, memories: 6, startPool: 3 } as const;

interface NarrativeFactBase {
  /** Stabile, monotone Fact-ID; macht Verarbeitung idempotent. */
  readonly id: number;
  readonly tick: number;
  readonly day: number;
}

interface StartPoolFact extends NarrativeFactBase {
  readonly kind: 'START_POOL';
  readonly visitorId: number;
  readonly capital: VaCoinMicro;
}

interface VisitorFirstSeenFact extends NarrativeFactBase {
  readonly kind: 'VISITOR_FIRST_SEEN';
  readonly visitorId: number;
  readonly persona: PersonaId;
}

interface VisitorReturnedFact extends NarrativeFactBase {
  readonly kind: 'VISITOR_RETURNED';
  readonly visitorId: number;
  readonly visits: number;
}

export interface VisitEndedFact extends NarrativeFactBase {
  readonly kind: 'VISIT_ENDED';
  readonly visitorId: number;
  readonly guestId: number;
  readonly score: number;
  readonly valence: VisitorValence;
}

export type NarrativeFact = StartPoolFact | VisitorFirstSeenFact | VisitorReturnedFact | VisitEndedFact;

/** Strukturierte Erinnerung, keine kopierte Journal-Zeile. */
export interface VisitorMemory {
  readonly factId: number;
  readonly tick: number;
  readonly score: number;
  readonly valence: VisitorValence;
}

export interface NarrativeState {
  /** Naechste freie Fact-ID. */
  factSeq: number;
  /** Noch nicht verarbeitete Facts; begrenzt. */
  pending: NarrativeFact[];
  /** Kurzzeitgedaechtnis fuer Ketten und Trigger; begrenzt. */
  recent: NarrativeFact[];
  /** Hoechste bereits verarbeitete Fact-ID; verhindert Doppelverarbeitung. */
  processedId: number;
  /** Wegen der Queue-Grenze verworfene Facts (Diagnose, kein Trigger). */
  dropped: number;
  /** Zaehler mit narrativer Bedeutung (Startkapital, Startpool, Rueckkehrer). */
  flags: Record<string, number>;
}
