/** Narrative Datenvertraege: Facts, Erinnerungen und persistenter Zustand als reine JSON-Daten. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { DemandEvent, PersonaId, RivalId } from '../types';
import type { NarrativeCooldown, NarrativeEventInstance, NarrativeRngState } from './event-types';

type NarrativeFactKind =
  | 'START_POOL' | 'VISITOR_FIRST_SEEN' | 'VISITOR_RETURNED' | 'VISIT_ENDED'
  | 'HOUSE_BALANCE' | 'VISITOR_CONFLICT' | 'VISITOR_SERVICE' | 'RIVAL_ENCOUNTER'
  | 'COMMAND_REJECTED' | 'EVENT_RESOLVED';
export type VisitorValence = 'GOOD' | 'NEUTRAL' | 'BAD';
export type HouseBand = 'LOW' | 'OK';

export const NARRATIVE_FACT_KINDS: readonly NarrativeFactKind[] = [
  'START_POOL', 'VISITOR_FIRST_SEEN', 'VISITOR_RETURNED', 'VISIT_ENDED',
  'HOUSE_BALANCE', 'VISITOR_CONFLICT', 'VISITOR_SERVICE', 'RIVAL_ENCOUNTER',
  'COMMAND_REJECTED', 'EVENT_RESOLVED',
];
export const VISITOR_VALENCES: readonly VisitorValence[] = ['GOOD', 'NEUTRAL', 'BAD'];
export const HOUSE_BANDS: readonly HouseBand[] = ['LOW', 'OK'];

/** Begrenzungen: Facts, Historie, Erinnerungen und Beziehungen wachsen nicht unkontrolliert. */
export const NARRATIVE_LIMITS = {
  pending: 48, recent: 120, memories: 6, startPool: 3, relationships: 200,
  eventInstances: 32, activeEvents: 8, cooldowns: 64,
} as const;

/** Kanonische, persistente Akteursreferenz; Gäste werden über visitor:<id> geführt. */
export type ActorRef = `visitor:${number}` | `staff:${number}` | `rival:${string}` | 'player';

/** Gerichtete Kante mit genau einem Besitzer in `NarrativeState.relationships`. */
export interface RelationshipEdge {
  readonly from: ActorRef;
  readonly to: ActorRef;
  readonly trust: number;
  readonly sympathy: number;
  readonly conflict: number;
  readonly influence: number;
  readonly updatedTick: number;
}

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

/** Ein reiner Welt-Fact ohne Besucherbezug: das Hauskonto hat einen Schwellenband gewechselt. */
interface HouseBalanceFact extends NarrativeFactBase {
  readonly kind: 'HOUSE_BALANCE';
  /** Hauskonto-Stand am Uebergang; als Verbindlichkeit darf er negativ sein. */
  readonly balance: VaCoinMicro;
  readonly band: HouseBand;
}

/** Ein realer Streit zwischen zwei Besuchern; beide Kanten entstehen aus demselben Fact. */
interface VisitorConflictFact extends NarrativeFactBase {
  readonly kind: 'VISITOR_CONFLICT';
  readonly actorRefs: readonly ActorRef[];
  readonly initiator: ActorRef;
  readonly severity: 1 | 2;
}

/** Eine reale Service-Interaktion zwischen Besucher und Personal, z. B. an der Kasse. */
interface VisitorServiceFact extends NarrativeFactBase {
  readonly kind: 'VISITOR_SERVICE';
  readonly actorRefs: readonly ActorRef[];
  readonly service: 'CASHIER';
  readonly valence: VisitorValence;
}

/** Nettofluss eines Rivalen-Spiels aus Sicht des Spielerhauses; positiv = Haus gewinnt. */
interface RivalEncounterFact extends NarrativeFactBase {
  readonly kind: 'RIVAL_ENCOUNTER';
  readonly actorRefs: readonly ActorRef[];
  readonly rivalId: RivalId;
  readonly netToHouse: VaCoinMicro;
}

/** Eine verworfene Direktive/Choice; nur Diagnose, nie eine Spielwirkung. */
interface CommandRejectedFact extends NarrativeFactBase {
  readonly kind: 'COMMAND_REJECTED';
  readonly commandId: string;
  readonly reason: string;
}

/** Eine erfolgreich aufgeloeste Choice; schliesst den Command-Fact-Kreis. */
interface EventResolvedFact extends NarrativeFactBase {
  readonly kind: 'EVENT_RESOLVED';
  readonly eventId: number;
  readonly eventKind: string;
  readonly choiceId: string;
  readonly outcomeId: string;
}

export type NarrativeFact =
  | StartPoolFact | VisitorFirstSeenFact | VisitorReturnedFact | VisitEndedFact
  | HouseBalanceFact | VisitorConflictFact | VisitorServiceFact | RivalEncounterFact
  | CommandRejectedFact | EventResolvedFact;

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
  /** Aktive Nachfrageveranstaltung; zugleich einzige Laufzeitwahrheit fuer deren Wirkung. */
  demandEvent: DemandEvent | null;
  /** Zaehler mit narrativer Bedeutung (Startkapital, Startpool, Rueckkehrer). */
  flags: Record<string, number>;
  /** Kanonische, gerichtete Beziehungen zwischen persistenten Akteuren. */
  relationships: RelationshipEdge[];
  /**
   * Ledger-`seq` der zuletzt verarbeiteten Buchung, nicht der Array-Index.
   * `null` heisst: noch kein Cursor; der erste Lauf setzt ihn ohne historische Facts.
   */
  ledgerSeq: number | null;
  /** Zuletzt gemeldeter Hauskonto-Band; verhindert doppelte Schwellen-Facts. */
  houseBand: HouseBand;
  /** Naechste freie Event-Instanz-ID. */
  eventSeq: number;
  /** Aktive und begrenzte abgeschlossene Event-Instanzen. */
  events: NarrativeEventInstance[];
  /** Cooldowns je Event und Teilnehmerkombination. */
  cooldowns: NarrativeCooldown[];
  /** Eigener persistenter Narrativ-Zufallsstrom. */
  rng: NarrativeRngState;
}
