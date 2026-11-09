/** Typen der Wissensdomäne: Wahrnehmung, Wissen und nachvollziehbare Herkunft. */
import type { ActorRef } from './types';

export type { ActorRef };

/** Wie jemand etwas erfahren hat; die Art bleibt an der Aussage haengen. */
export type KnowledgeSourceKind = 'ERLEBT' | 'GESEHEN' | 'GEHOERT' | 'GELESEN';

/** Wahrnehmungskanal; direkte Kanaele setzen Anwesenheit voraus. */
export type ObservationChannel = 'SELBST' | 'SICHT' | 'GERAEUSCH' | 'GESPRAECH' | 'NACHRICHT' | 'DOKUMENT';

/** Eine tatsaechliche Wahrnehmung: wer, was, wodurch, wann, wie gut. */
export interface Observation {
  readonly id: number;
  readonly actor: ActorRef;
  readonly factId: number;
  readonly channel: ObservationChannel;
  readonly tick: number;
  readonly quality: number;
}

/**
 * Ein Wissenstand mit Provenance. `sourceActor` ist die unmittelbare Quelle,
 * `originActor` die urspruengliche Wahrnehmung; `distance` zaehlt Weitergaben.
 * Widersprueche bleiben als getrennte Eintraege erhalten und werden nicht
 * still ueberschrieben.
 */
/** Ein einzelner, nicht doppelt zaehlender Grund fuer Weitergabe oder Glauben. */
export interface ExchangeReason {
  readonly code: string;
  readonly delta: number;
  readonly detail: string;
}

/**
 * Eine belegte Wissens-Weitergabe: Absicht, Urteil und Gruende. `shared: false`
 * heisst, der Sprecher hat geschwiegen; `accepted: null` heisst, es kam nicht
 * zum Urteil. Der Log ist die Erklaerung der Simulation, kein zweiter Zustand.
 */
export interface KnowledgeExchange {
  readonly id: number;
  readonly tick: number;
  readonly seed: number;
  readonly from: ActorRef;
  readonly to: ActorRef;
  readonly factId: number;
  readonly shared: boolean;
  readonly accepted: boolean | null;
  readonly score: number;
  readonly threshold: number;
  readonly reasons: readonly ExchangeReason[];
  readonly entryId: number | null;
}

export interface KnowledgeEntry {
  readonly id: number;
  readonly actor: ActorRef;
  readonly topic: string;
  readonly subject: ActorRef;
  readonly sentiment: number;
  readonly confidence: number;
  readonly sourceKind: KnowledgeSourceKind;
  readonly sourceActor: ActorRef;
  readonly originActor: ActorRef;
  readonly distance: number;
  /** Tick der urspruenglichen Wahrnehmung. */
  readonly observedTick: number;
  /** Tick, an dem dieser NPC den Stand erhielt. */
  readonly tick: number;
  /** Letzter angewendeter Alterungsschritt; verhindert doppelte Abwertung. */
  readonly decayedTick: number;
  readonly factId: number;
}
