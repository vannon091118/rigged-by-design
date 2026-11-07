/** Rivalen-Domaene: persistenter Zustand, Absichts-Typen und harte Grenzen. */
import type { RivalId } from '../types-model';

export type RivalStance = 'NEUTRAL' | 'COOPERATIVE' | 'COMPETITIVE' | 'HOSTILE';
export type RivalActionId = 'PROBE' | 'TRADE_INFO' | 'PRICE_MOVE' | 'POACH_VISITOR' | 'SABOTAGE';

export const RIVAL_STANCES: readonly RivalStance[] = ['NEUTRAL', 'COOPERATIVE', 'COMPETITIVE', 'HOSTILE'];
export const RIVAL_ACTION_IDS: readonly RivalActionId[] = [
  'PROBE', 'TRADE_INFO', 'PRICE_MOVE', 'POACH_VISITOR', 'SABOTAGE',
];

/** Ein Indiz: was der Spieler ueber eine Rivalenhandlung weiss und woher. */
export interface RivalEvidence {
  readonly action: RivalActionId;
  readonly tick: number;
  readonly day: number;
  readonly machineId: number | null;
  /** true = der Guard hat die Wirkung verhindert; das Indiz bleibt trotzdem. */
  readonly blocked: boolean;
  readonly note: string;
}

export interface RivalActionRecord {
  readonly action: RivalActionId;
  readonly tick: number;
  readonly day: number;
  readonly summary: string;
}

/**
 * Der einzige persistente Rivalen-Zustand. Ruf, Attraktivitaet und Sicherheit
 * bleiben abgeleitet (`rivalState`); hier steht nur, was sich durch Handeln aendert.
 */
export interface RivalMindState {
  readonly rivalId: RivalId;
  stance: RivalStance;
  /** Handlungsfaehigkeit 0..100. */
  capacity: number;
  /** Haltung zum Spielerhaus -100..100. */
  goodwill: number;
  nextActionTick: number;
  /** Bis zu diesem Tick verzichtet der Rivale auf Aktionen (Gegenmassnahme). */
  counteredUntilTick: number;
  history: RivalActionRecord[];
  evidence: RivalEvidence[];
}

export const RIVAL_AI_LIMITS = {
  history: 6,
  evidence: 4,
  /** Abstand zwischen zwei geplanten Aktionen in Ticks. */
  cadence: 260,
  /** Vor diesem Tick handelt kein Rivale: erst muss ein Haus stehen. */
  firstActionTick: 150,
  counteredTicks: 900,
  capacityMin: 0,
  capacityMax: 100,
  goodwillMin: -100,
  goodwillMax: 100,
  startCapacity: 60,
} as const;
