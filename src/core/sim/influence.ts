/**
 * Einfluss-Matrix: gewichtete Faktoren, Untereinfluesse, Kontexte und
 * Cross-Kanten. Rein und deterministisch: gleiche Eingaben ergeben gleiche
 * Punktzahl, kein RNG. Die balancebare Config liegt in `influence-matrix.ts`.
 */
import {
  FACTOR_IDS, INFLUENCE_CONFIG, validateInfluenceConfig,
  type InfluenceConfig, type InfluenceFactorId, type InfluenceValues,
} from './influence-config';
import { createFactor, type Factor, type FactorChild } from '../contracts/factor';

export { INFLUENCE_CONFIG } from './influence-config';
export type { InfluenceConfig, InfluenceFactorId, InfluenceValues } from './influence-config';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Normiert einen Rohwert auf 0..1; unbekannte Faktoren sind ein Programmierfehler. */
function normalize(config: InfluenceConfig, id: InfluenceFactorId, raw: number): number {
  const range = config.factors[id].range;
  const span = range.max - range.min;
  if (!(span > 0)) throw new Error(`Einfluss-Faktor ${id} hat keinen gueltigen Wertebereich.`);
  return clamp01((raw - range.min) / span);
}

function factorChildren(config: InfluenceConfig): readonly FactorChild[] {
  return FACTOR_IDS.flatMap((id) => config.factors[id].children.map((child) => ({
    id: child.id,
    category: child.category,
    baseWeight: child.baseWeight,
    weight: child.weight,
  })));
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
 * Wertet die Matrix fuer einen Kontext aus. Untereinfluesse addieren ihren
 * gewichteten Beitrag auf den Oberfaktor; Cross-Kanten lesen den normierten
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
  for (const id of FACTOR_IDS) raw.set(id, normalize(config, id, values[id] ?? 0));

  const effective = new Map<InfluenceFactorId, number>();
  for (const id of FACTOR_IDS) {
    let value = raw.get(id)!;
    for (const child of config.factors[id].children) {
      value += child.baseWeight * child.weight * raw.get(child.source)!;
    }
    effective.set(id, clamp01(value));
  }
  for (const edge of config.cross) {
    if (edge.contexts && !edge.contexts.includes(contextName)) continue;
    const source = raw.get(edge.from)!;
    const target = effective.get(edge.to)!;
    effective.set(edge.to, clamp01(target + source * edge.weight));
  }

  let total = 0;
  let weightSum = 0;
  const contributions: string[] = [];
  for (const id of FACTOR_IDS) {
    const factor = config.factors[id];
    const weight = context.weights[id] * factor.baseWeight;
    const value = effective.get(id)!;
    total += value * weight;
    weightSum += weight;
    if (weight > 0) contributions.push(`${id}=${value.toFixed(2)}x${weight.toFixed(2)}`);
  }
  if (!(weightSum > 0)) throw new Error(`Einfluss-Matrix: Kontext ${contextName} hat kein wirksames Gewicht.`);
  const score = clamp01(total / weightSum);
  const trace = createFactor(`influence_${contextName}`, {
    context: contextName,
    threshold: String(context.threshold),
  }, contributions, {
    category: 'MATRIX',
    baseWeight: 1,
    children: factorChildren(config),
  });

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

/**
 * Wirkung einer Zuwendung (Döner/Drink) relativ ohne Zufriedenheitswert.
 * Die Differenz ist am Slot exakt 0, weil dort kein Faktor und keine Kante
 * den Zufriedenheitswert liest; an der Bar liefert die Config den Ausschlag.
 */
export function treatInfluence(
  contextName: string,
  values: InfluenceValues,
  config: InfluenceConfig = INFLUENCE_CONFIG,
): number {
  return influenceScore(contextName, values, config)
    - influenceScore(contextName, { ...values, satisfaction: 0 }, config);
}

/** Loest die Möbelart ueber die Config in einen Matrix-Kontext auf. */
export function influenceContextForFurniture(
  kind: string,
  config: InfluenceConfig = INFLUENCE_CONFIG,
): string {
  return config.furnitureContexts[kind] ?? config.defaultContext;
}
