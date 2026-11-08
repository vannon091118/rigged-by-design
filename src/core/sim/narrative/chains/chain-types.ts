/**
 * Verkettete Narrative: Ein Graph aus stabilen Knoten und bedingten Uebergaengen.
 * Die Definition beschreibt nur, was mechanisch moeglich ist; Text bleibt im
 * Composer, Fakten und Erinnerungen bleiben in der Wissensdomaene.
 */
import type { VaCoinMicro } from '../../../economy/vacoin';
import type { InfluenceConfig, InfluenceValues } from '../../influence';
import type { NarrativeEventInstance } from '../event-types';
import type { ChoiceActor } from '../events/template-types';
import type { KnowledgeEntry, KnowledgeSourceKind } from '../knowledge-types';
import type { RelationshipDimension } from '../trigger-types';
import type { ActorRef, NarrativeFact, RelationshipEdge } from '../types';

export type ChainCondition =
  | { readonly op: 'all'; readonly conditions: readonly ChainCondition[] }
  | { readonly op: 'any'; readonly conditions: readonly ChainCondition[] }
  | { readonly op: 'not'; readonly condition: ChainCondition }
  | { readonly op: 'flag-between'; readonly flag: string; readonly min?: number; readonly max?: number }
  | { readonly op: 'flag-present'; readonly flag: string }
  | { readonly op: 'flag-absent'; readonly flag: string }
  | {
    readonly op: 'relationship-between'; readonly from: ChoiceActor; readonly to: ChoiceActor;
    readonly dimension: RelationshipDimension; readonly min?: number; readonly max?: number;
  }
  | { readonly op: 'house-between'; readonly min?: number; readonly max?: number }
  | { readonly op: 'reputation-between'; readonly min?: number; readonly max?: number }
  | {
    readonly op: 'influence-between'; readonly context: string;
    readonly min?: number; readonly max?: number; readonly actor?: ChoiceActor;
  }
  | {
    readonly op: 'knowledge'; readonly actor: ChoiceActor; readonly topic: string;
    readonly minConfidence: number; readonly sourceKind?: KnowledgeSourceKind;
  }
  | {
    readonly op: 'fact-count'; readonly kind: NarrativeFact['kind'];
    readonly ticks?: number; readonly minCount: number;
  }
  | {
    readonly op: 'event-resolved'; readonly eventId: string;
    readonly outcomeId?: string; readonly ticks?: number;
  }
  | { readonly op: 'chain-visited'; readonly nodeId: string; readonly minCount: number }
  | { readonly op: 'tick-between'; readonly min?: number; readonly max?: number }
  | { readonly op: 'day-between'; readonly min?: number; readonly max?: number };

/** Wie ein Folgeknoten seine Teilnehmer aus dem laufenden Knoten ableitet. */
export type ChainParticipantMode = 'inherit' | 'first' | 'last';

export interface ChainNode {
  readonly nodeId: string;
  /** Stabile Event-Template-ID; der Text wird ausschliesslich dort verdrahtet. */
  readonly eventId: string;
  readonly participantMode?: ChainParticipantMode;
  /** Ein Endknoten braucht keinen Uebergang; jeder andere braucht mindestens einen. */
  readonly terminal?: boolean;
  /** Bricht den Lauf ab, bevor ein Uebergang gewaehlt wird. */
  readonly abort?: ChainCondition;
}

export interface ChainEdge {
  readonly edgeId: string;
  readonly from: string;
  readonly to: string;
  /** Fehlt die Bedingung, ist der Uebergang mechanisch immer moeglich. */
  readonly when?: ChainCondition;
  /** 0 oder weggelassen heisst sofort; sonst ruht der Lauf bis zum Faelligkeitstakt. */
  readonly delayTicks?: number;
  /** Hoerer Wert gewinnt; bei Gleichstand entscheidet die stabile edgeId. */
  readonly priority?: number;
  /** Erlaubt das erneute Betreten eines bereits besuchten Knotens. */
  readonly repeatable?: boolean;
  /** Mehrere parallele Uebergaenge duerfen gleichzeitig eigene Laeufe starten. */
  readonly parallel?: boolean;
}

export interface NarrativeChain {
  readonly chainId: string;
  readonly version: number;
  readonly start: string;
  readonly nodes: readonly ChainNode[];
  readonly edges: readonly ChainEdge[];
  readonly abort?: ChainCondition;
  readonly maxSteps: number;
  readonly maxDurationTicks: number;
  /** Nur eine ausdruecklich wiederholbare Kette darf erneut beginnen. */
  readonly repeatable: boolean;
  readonly cooldownTicks: number;
}

export type ChainRunStatus = 'RUNNING' | 'WAITING' | 'COMPLETED' | 'ABORTED';

export const CHAIN_RUN_STATUSES: readonly ChainRunStatus[] = [
  'RUNNING', 'WAITING', 'COMPLETED', 'ABORTED',
];

export interface ChainRun {
  readonly id: number;
  readonly chainId: string;
  readonly chainVersion: number;
  /** Knoten, der gerade laeuft oder als Naechstes geplant ist. */
  readonly nodeId: string;
  /** Aktuell angebotene Instanz; `null` heisst: Knoten ist noch nicht geplant. */
  readonly eventInstanceId: number | null;
  /** Zuletzt aufgeloeste Instanz, die diesen Lauf vorangetrieben hat. */
  readonly sourceEventId: number | null;
  readonly status: ChainRunStatus;
  readonly participants: readonly ActorRef[];
  readonly startedTick: number;
  readonly updatedTick: number;
  /** Ab diesem Takt wird ein ruhender Lauf erneut geprueft. */
  readonly dueTick: number;
  readonly steps: number;
  readonly visits: Readonly<Record<string, number>>;
  /** Gewaehlter, aber noch nicht geplanter Uebergang; wird bei Faelligkeit erneut geprueft. */
  readonly pendingEdgeId: string | null;
  readonly lastChoiceId: string | null;
  readonly lastOutcomeId: string | null;
  readonly reason: string | null;
}

export interface ChainState {
  runs: ChainRun[];
  runSeq: number;
}

/** Reine Leseansicht fuer Bedingungen; keine Welt-, Ledger- oder RNG-Mutation. */
export interface ChainContext {
  readonly tick: number;
  readonly day: number;
  readonly participants: readonly ActorRef[];
  readonly visits: Readonly<Record<string, number>>;
  readonly flags: Readonly<Record<string, number>>;
  readonly relationships: readonly RelationshipEdge[];
  readonly knowledge: readonly KnowledgeEntry[];
  readonly recent: readonly NarrativeFact[];
  readonly events: readonly NarrativeEventInstance[];
  readonly houseBalance: VaCoinMicro;
  readonly reputation: number;
  readonly influence: InfluenceValues;
  readonly influenceByActor: ReadonlyMap<ActorRef, InfluenceValues>;
  readonly influenceConfig: InfluenceConfig;
  readonly lastChoiceId: string | null;
  readonly lastOutcomeId: string | null;
}

export interface ChainConditionResult {
  readonly matched: boolean;
  readonly reasons: readonly string[];
}
