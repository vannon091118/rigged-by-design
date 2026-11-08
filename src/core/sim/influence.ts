/**
 * Einfluss-Matrix: gewichtete Faktoren, Kontexte und Cross-Kanten. Rein und
 * deterministisch: gleiche Eingaben ergeben gleiche Punktzahl, kein RNG.
 * Die balancebare Config liegt in `influence-config.ts`.
 */
import {
  FACTOR_IDS, INFLUENCE_CONFIG, validateInfluenceConfig,
  type InfluenceConfig, type InfluenceFactorId, type InfluenceValues,
} from './influence-config';
import { createFactor, type Factor } from '../contracts/factor';

export { INFLUENCE_CONFIG } from './influence-config';
export type { InfluenceConfig, InfluenceFactorId, InfluenceValues } from './influence-config';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Normiert einen Rohwert auf 0..1; unbekannte Faktoren sind ein Programmierfehler. */
function normalize(config: InfluenceConfig, id: InfluenceFactorId, raw: number): number {
  const range = config.factors[id];
  const span = range.max - range.min;
  if (!(span > 0)) throw new Error(`Einfluss-Faktor ${id} hat keinen gueltigen Wertebereich.`);
  return clamp01((raw - range.min) / span);
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
