/**
 * Matrix-Config: Faktoren, Kontexte und Cross-Kanten. Beziehungen sind eigene
 * Faktoren (trust, sympathy, conflict), damit sie ueber dieselbe Matrix
 * balancebar sind wie Laune, Geselligkeit, Durst und Gerede.
 */
import { EVENT_POOL_CONFIG, validateEventPool, type EventPoolConfig } from './influence-event-pool';

export type { EventPoolConfig, EventPoolEntry } from './influence-event-pool';

export type InfluenceFactorId =
  | 'mood' | 'sociability' | 'thirst' | 'rumor' | 'trust' | 'sympathy' | 'conflict';

export interface InfluenceValues {
  readonly mood: number;
  readonly sociability: number;
  readonly thirst: number;
  readonly rumor: number;
  readonly trust: number;
  readonly sympathy: number;
  readonly conflict: number;
}

interface FactorRange {
  readonly min: number;
  readonly max: number;
}

interface InfluenceContext {
  readonly label: string;
  /** Gewicht je Faktor; 0 schaltet den Faktor in diesem Kontext aus. */
  readonly weights: Readonly<Record<InfluenceFactorId, number>>;
  /** Ab dieser Punktzahl gilt der Kontext als ausgeloest (0..1). */
  readonly threshold: number;
}

interface CrossEdge {
  readonly from: InfluenceFactorId;
  readonly to: InfluenceFactorId;
  readonly weight: number;
}

export interface InfluenceConfig {
  readonly version: 1;
  readonly factors: Readonly<Record<InfluenceFactorId, FactorRange>>;
  readonly contexts: Readonly<Record<string, InfluenceContext>>;
  readonly cross: readonly CrossEdge[];
  readonly eventPool: EventPoolConfig;
}

export const FACTOR_IDS: readonly InfluenceFactorId[] = [
  'mood', 'sociability', 'thirst', 'rumor', 'trust', 'sympathy', 'conflict',
];

/**
 * Standardmatrix. Zuwendung zieht an der Bar, am Slot fast gar nicht; Vertrauen
 * und Sympathie heben die Geselligkeit, Konflikt senkt sie ueber eine Cross-Kante.
 */
export const INFLUENCE_CONFIG: InfluenceConfig = {
  version: 1,
  factors: {
    mood: { min: 0, max: 100 },
    sociability: { min: 0, max: 100 },
    thirst: { min: 0, max: 100 },
    rumor: { min: -1, max: 1 },
    trust: { min: -10, max: 10 },
    sympathy: { min: -10, max: 10 },
    conflict: { min: -10, max: 10 },
  },
  contexts: {
    bar: {
      label: 'Bar',
      weights: {
        mood: 0.3, sociability: 0.1, thirst: 0.3, rumor: 0.1,
        trust: 0.1, sympathy: 0.05, conflict: 0,
      },
      threshold: 0.6,
    },
    slot: {
      label: 'Spielgeraet',
      // Am Automaten hilft keine Zuwendung: nur Gerede ueber das Geraet zaehlt.
      weights: {
        mood: 0, sociability: 0, thirst: 0, rumor: 0.15,
        trust: 0, sympathy: 0, conflict: 0,
      },
      threshold: 0.8,
    },
    // Pool-Kontexte: Zuwendung oeffnet eine Szene, Konflikt schliesst sie.
    'event-warm': {
      label: 'Pool: Zuwendung',
      weights: {
        mood: 0.1, sociability: 0.2, thirst: 0, rumor: 0,
        trust: 0.3, sympathy: 0.3, conflict: 0,
      },
      threshold: 0.45,
    },
    'event-tense': {
      label: 'Pool: Spannung',
      weights: {
        mood: 0, sociability: 0.1, thirst: 0, rumor: 0,
        trust: 0, sympathy: 0, conflict: 0.7,
      },
      threshold: 0.5,
    },
    'event-neutral': {
      label: 'Pool: Alltag',
      weights: {
        mood: 0.2, sociability: 0.4, thirst: 0.2, rumor: 0.1,
        trust: 0.05, sympathy: 0.05, conflict: 0,
      },
      threshold: 0.5,
    },
    // Weitergabe von Wissen ist kein Sonderfall neben der Matrix: dieselben
    // Faktoren und Cross-Kanten entscheiden, ob jemand erzaehlt.
    share: {
      label: 'Weitergabe',
      weights: {
        mood: 0.2, sociability: 0.3, thirst: 0, rumor: 0.1,
        trust: 0.1, sympathy: 0.1, conflict: 0,
      },
      threshold: 0.38,
    },
  },
  cross: [
    // Durst drueckt die Laune, bevor die Bar ihn gewichtet.
    { from: 'thirst', to: 'mood', weight: -0.2 },
    // Gerede faerbt die Laune.
    { from: 'rumor', to: 'mood', weight: 0.25 },
    // Wer gesellig ist, merkt Durst spaeter.
    { from: 'sociability', to: 'thirst', weight: -0.1 },
    // Vertrauen oeffnet, Konflikt schliesst: beides wirkt auf die Geselligkeit.
    { from: 'trust', to: 'sociability', weight: 0.15 },
    { from: 'sympathy', to: 'sociability', weight: 0.1 },
    { from: 'conflict', to: 'sociability', weight: -0.25 },
  ],
  eventPool: EVENT_POOL_CONFIG,
};

/** Prueft die Matrix fail-closed: eine unlesbare Config darf nie still weiterlaufen. */
export function validateInfluenceConfig(config: InfluenceConfig): void {
  if (config.version !== 1) throw new Error('Einfluss-Matrix: unbekannte Version.');
  for (const id of FACTOR_IDS) {
    const range = config.factors[id];
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) {
      throw new Error(`Einfluss-Matrix: Faktor ${id} hat keinen gueltigen Wertebereich.`);
    }
  }
  const contexts = Object.keys(config.contexts);
  if (contexts.length === 0) throw new Error('Einfluss-Matrix: kein Kontext definiert.');
  for (const name of contexts) {
    const context = config.contexts[name]!;
    if (!Number.isFinite(context.threshold) || context.threshold < 0 || context.threshold > 1) {
      throw new Error(`Einfluss-Matrix: Kontext ${name} hat eine Schwelle ausserhalb 0..1.`);
    }
    let sum = 0;
    for (const id of FACTOR_IDS) {
      const weight = context.weights[id];
      if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
        throw new Error(`Einfluss-Matrix: Kontext ${name} gewichtet ${id} ungueltig.`);
      }
      sum += weight;
    }
    if (sum <= 0) throw new Error(`Einfluss-Matrix: Kontext ${name} hat kein Gewicht.`);
  }
  for (const edge of config.cross) {
    if (!FACTOR_IDS.includes(edge.from) || !FACTOR_IDS.includes(edge.to)) {
      throw new Error(`Einfluss-Matrix: Cross-Kante ${edge.from}->${edge.to} zeigt auf einen unbekannten Faktor.`);
    }
    if (!Number.isFinite(edge.weight) || edge.weight < -1 || edge.weight > 1) {
      throw new Error(`Einfluss-Matrix: Cross-Kante ${edge.from}->${edge.to} hat ein ungueltiges Gewicht.`);
    }
  }
  validateEventPool(config.eventPool, config.contexts);
}
