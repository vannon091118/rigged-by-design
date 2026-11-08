/**
 * Einfluss-Matrix: gewichtete Faktoren, Kontexte und Cross-Abhaengigkeiten.
 *
 * Die Matrix ist eine Config, keine Doku. Jeder Faktor traegt einen Wertebereich,
 * jeder Kontext gewichtet dieselben Faktoren anders. Cross-Kanten heben oder
 * senken einen Faktor, bevor der Kontext ihn gewichtet. Alles ist rein,
 * deterministisch und ohne Zufall: gleiche Eingaben ergeben gleiche Punktzahl.
 */
import { createFactor, type Factor } from '../contracts/factor';

type InfluenceFactorId = 'mood' | 'sociability' | 'thirst' | 'rumor';

export interface InfluenceValues {
  readonly mood: number;
  readonly sociability: number;
  readonly thirst: number;
  readonly rumor: number;
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
  /** Quelle des Einflusses. */
  readonly from: InfluenceFactorId;
  /** Ziel, dessen Wert verschoben wird. */
  readonly to: InfluenceFactorId;
  /** Staerke in Punkten des normierten Zielwerts, -1..1. */
  readonly weight: number;
}

export interface InfluenceConfig {
  readonly version: 1;
  readonly factors: Readonly<Record<InfluenceFactorId, FactorRange>>;
  readonly contexts: Readonly<Record<string, InfluenceContext>>;
  readonly cross: readonly CrossEdge[];
}

/**
 * Standardmatrix. Die Synergie ist absichtlich kontextabhaengig:
 * Zuwendung und Durst ziehen an der Bar, am Slot fast gar nicht.
 */
export const INFLUENCE_CONFIG: InfluenceConfig = {
  version: 1,
  factors: {
    mood: { min: 0, max: 100 },
    sociability: { min: 0, max: 100 },
    thirst: { min: 0, max: 100 },
    rumor: { min: -1, max: 1 },
  },
  contexts: {
    bar: {
      label: 'Bar',
      weights: { mood: 0.35, sociability: 0.15, thirst: 0.35, rumor: 0.15 },
      threshold: 0.62,
    },
    slot: {
      label: 'Spielgeraet',
      // Am Automaten hilft keine Zuwendung: nur Gerede ueber das Geraet zaehlt.
      weights: { mood: 0, sociability: 0, thirst: 0, rumor: 0.15 },
      threshold: 0.8,
    },
  },
  cross: [
    // Durst drueckt die Laune, bevor die Bar ihn gewichtet.
    { from: 'thirst', to: 'mood', weight: -0.2 },
    // Gerede faerbt die Laune.
    { from: 'rumor', to: 'mood', weight: 0.25 },
    // Wer gesellig ist, merkt Durst spaeter.
    { from: 'sociability', to: 'thirst', weight: -0.1 },
  ],
};

const FACTOR_IDS: readonly InfluenceFactorId[] = ['mood', 'sociability', 'thirst', 'rumor'];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function rangeOf(config: InfluenceConfig, id: InfluenceFactorId): FactorRange {
  const range = config.factors[id];
  return range;
}

/** Normiert einen Rohwert auf 0..1; unbekannte Faktoren sind ein Programmierfehler. */
function normalize(config: InfluenceConfig, id: InfluenceFactorId, raw: number): number {
  const range = rangeOf(config, id);
  const span = range.max - range.min;
  if (!(span > 0)) throw new Error(`Einfluss-Faktor ${id} hat keinen gueltigen Wertebereich.`);
  return clamp01((raw - range.min) / span);
}

/** Prueft die Matrix fail-closed: eine unlesbare Config darf nie still weiterlaufen. */
function validateInfluenceConfig(config: InfluenceConfig): void {
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
}

interface InfluenceResult {
  readonly context: string;
  readonly score: number;
  readonly threshold: number;
  readonly triggered: boolean;
  /** Nachvollziehbarer Trace, ein Eintrag je Faktor. */
  readonly contributions: readonly string[];
  /** Der Faktor selbst, damit der Contract dieselbe Sprache spricht. */
  readonly factor: Factor;
}

/**
 * Wertet die Matrix fuer einen Kontext aus. Cross-Kanten lesen den normierten
 * Rohwert der Quelle, damit die Reihenfolge der Kanten das Ergebnis nicht dreht.
 */
export function evaluateInfluence(
  contextName: string,
  values: InfluenceValues,
  config: InfluenceConfig = INFLUENCE_CONFIG,
): InfluenceResult {
  validateInfluenceConfig(config);
  const context = config.contexts[contextName];
  if (!context) throw new Error(`Einfluss-Matrix: unbekannter Kontext ${contextName}.`);

  const raw = new Map<InfluenceFactorId, number>();
  for (const id of FACTOR_IDS) raw.set(id, normalize(config, id, values[id]));

  const effective = new Map<InfluenceFactorId, number>(raw);
  for (const edge of config.cross) {
    const source = raw.get(edge.from)!;
    const target = effective.get(edge.to)!;
    effective.set(edge.to, clamp01(target + source * edge.weight));
  }

  let total = 0;
  let weightSum = 0;
  const contributions: string[] = [];
  for (const id of FACTOR_IDS) {
    const weight = context.weights[id];
    const value = effective.get(id)!;
    total += value * weight;
    weightSum += weight;
    if (weight > 0) contributions.push(`${id}=${value.toFixed(2)}x${weight}`);
  }
  const score = clamp01(total / weightSum);
  const trace = createFactor(`influence_${contextName}`, {
    context: contextName,
    threshold: String(context.threshold),
  }, contributions);

  return {
    context: contextName,
    score,
    threshold: context.threshold,
    triggered: score >= context.threshold,
    contributions,
    factor: trace,
  };
}

/** Kurzform fuer Consumer: Punktzahl eines Kontexts. */
export function influenceScore(
  contextName: string,
  values: InfluenceValues,
  config: InfluenceConfig = INFLUENCE_CONFIG,
): number {
  return evaluateInfluence(contextName, values, config).score;
}
