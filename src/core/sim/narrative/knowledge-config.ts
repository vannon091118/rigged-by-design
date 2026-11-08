/**
 * Wissens-Config: Quellengewichte, Beziehungsbonus und Distanzkurve.
 *
 * Bewusst getrennt von der Kette selbst: Diese Werte sind balancebar, die
 * Ableitung (wer hoert wen, was geht verloren) bleibt in `knowledge.ts`.
 */
import type { KnowledgeSourceKind, RelationshipEdge } from './types';

const SOURCE_KINDS: readonly KnowledgeSourceKind[] = ['ERLEBT', 'GESEHEN', 'GEHOERT', 'GELESEN'];
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export interface KnowledgeConfig {
  readonly version: 1;
  readonly sourceWeight: Readonly<Record<KnowledgeSourceKind, number>>;
  readonly relationship: {
    readonly trust: number; readonly sympathy: number;
    readonly influence: number; readonly conflict: number;
  };
  readonly distance: {
    readonly lossPerStep: number; readonly distortionPerStep: number;
    readonly confidenceDecay: number; readonly maxDistance: number;
  };
  readonly aging: { readonly graceTicks: number; readonly decayPerTick: number; readonly minConfidence: number };
  readonly limits: { readonly maxEntries: number; readonly maxObservations: number; readonly minConfidence: number };
}

/**
 * Standardwerte: eigene Erfahrung wiegt am schwersten, Hoerensagen weniger.
 * Eine enge Bezugsperson hebt das Gewicht ueber die Beziehung, nicht ueber eine
 * globale Konstante; ein Fremder bleibt auf dem Basiswert.
 */
export const KNOWLEDGE_CONFIG: KnowledgeConfig = {
  version: 1,
  sourceWeight: { ERLEBT: 1, GESEHEN: 0.8, GEHOERT: 0.55, GELESEN: 0.5 },
  relationship: { trust: 0.04, sympathy: 0.03, influence: 0.02, conflict: 0.06 },
  distance: { lossPerStep: 0.12, distortionPerStep: 0.18, confidenceDecay: 0.1, maxDistance: 4 },
  aging: { graceTicks: 8, decayPerTick: 0.01, minConfidence: 0.05 },
  limits: { maxEntries: 160, maxObservations: 160, minConfidence: 0.05 },
};

/** Prueft die Config fail-closed: eine unlesbare Kette darf nie still weiterlaufen. */
export function validateKnowledgeConfig(config: KnowledgeConfig): void {
  if (config.version !== 1) throw new Error('Wissenskette: unbekannte Version.');
  for (const kind of SOURCE_KINDS) {
    const weight = config.sourceWeight[kind];
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new Error(`Wissenskette: Quellengewicht ${kind} liegt ausserhalb 0..1.`);
    }
  }
  for (const [name, value] of Object.entries(config.relationship)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Wissenskette: Beziehungsgewicht ${name} liegt ausserhalb 0..1.`);
    }
  }
  const { lossPerStep, distortionPerStep, confidenceDecay, maxDistance } = config.distance;
  for (const [name, value] of Object.entries({ lossPerStep, distortionPerStep, confidenceDecay })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Wissenskette: Distanzwert ${name} liegt ausserhalb 0..1.`);
    }
  }
  if (!Number.isInteger(maxDistance) || maxDistance < 1 || maxDistance > 8) {
    throw new Error('Wissenskette: maxDistance muss eine ganze Zahl zwischen 1 und 8 sein.');
  }
  const { graceTicks, decayPerTick, minConfidence: agingFloor } = config.aging;
  if (!Number.isInteger(graceTicks) || graceTicks < 0 || graceTicks > 1000) {
    throw new Error('Wissenskette: graceTicks ist ungueltig.');
  }
  for (const [name, value] of Object.entries({ decayPerTick, agingFloor })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Wissenskette: Alterungswert ${name} liegt ausserhalb 0..1.`);
    }
  }
  const { maxEntries, maxObservations, minConfidence } = config.limits;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('Wissenskette: maxEntries muss positiv sein.');
  if (!Number.isInteger(maxObservations) || maxObservations < 1) {
    throw new Error('Wissenskette: maxObservations muss positiv sein.');
  }
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new Error('Wissenskette: minConfidence liegt ausserhalb 0..1.');
  }
}

/** Verlust- und Verdrehungsrisiko je Distanz; monoton steigend und gedeckelt. */
export function knowledgeRisk(
  config: KnowledgeConfig,
  distance: number,
): { readonly loss: number; readonly distortion: number } {
  const step = Math.max(1, Math.floor(distance));
  return {
    loss: clamp(config.distance.lossPerStep * step, 0, 1),
    distortion: clamp(config.distance.distortionPerStep * step, 0, 1),
  };
}

/**
 * Gewicht einer Quelle fuer den Empfaenger: Basis der Quellenart plus die
 * konkrete Beziehung (Vertrauen, Sympathie, Einfluss) minus Konflikt.
 */
export function sourceWeightOf(
  config: KnowledgeConfig,
  kind: KnowledgeSourceKind,
  edge: RelationshipEdge | null,
): number {
  const base = config.sourceWeight[kind];
  if (!edge) return base;
  const bonus =
    edge.trust * config.relationship.trust +
    edge.sympathy * config.relationship.sympathy +
    edge.influence * config.relationship.influence -
    edge.conflict * config.relationship.conflict;
  return clamp(base + bonus, 0, 1);
}

export { SOURCE_KINDS };
