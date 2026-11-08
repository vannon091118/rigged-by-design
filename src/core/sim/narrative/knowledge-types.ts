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
