/**
 * Factor Normalizer — Phase 3
 * Reine Übersetzungsfunktionen: Wandelt Rohwerte in kontextabhängige Factors um.
 *
 * Der Normalizer nimmt Rohwerte (z. B. eine geschenkte Summe, ein Konflikt-Schweregrad)
 * und übersetzt sie in kontextabhängige Factor-Beiträge (weightBps, maxApplicableScore).
 * Keine Seiteneffekte, reine Funktionen.
 */

import type { WorldTime } from "./sim/worldtime";
import type {
  FactorDefinition,
  FactorContribution,
  FactorContext,
} from "./factor-catalog";
import { factorCatalog } from "./factor-catalog";

export interface NormalizationContext {
  readonly context: FactorContext;
  readonly worldTime: WorldTime;
  readonly actorPair: [string, string]; // [from, to]
  readonly sourceEvent?: string; // auslösendes Event oder Command
}

export interface RawSocialSignal {
  readonly type:
    | "gift"
    | "compliment"
    | "insult"
    | "conflict"
    | "betrayal"
    | "loan"
    | "favor"
    | "promotion"
    | "demotion"
    | "family_support"
    | "family_conflict";
  readonly value: number; // Rohwert (z. B. Betrag, Schweregrad 1-10)
  readonly intensity?: number; // 0.0 .. 1.0 (Standard 1.0)
}

export interface NormalizedFactor {
  readonly factorId: string;
  readonly weightBps: number;
  readonly maxApplicableScore: number;
  readonly decayPerTick: number;
  readonly sourceContext: FactorContext;
  readonly source: string;
  readonly appliedAtTick: number;
}

/**
 * Übersetzt ein soziales Signal in einen kontextabhängigen Factor.
 * Reine Funktion — keine Seiteneffekte.
 */
export function normalizeSignal(
  signal: RawSocialSignal,
  ctx: NormalizationContext
): NormalizedFactor | null {
  const intensity = signal.intensity ?? 1.0;
  const context = ctx.context;
  const worldTime = ctx.worldTime;

  // Basis-Faktor aus dem Katalog holen
  const factorMap: Record<string, string> = {
    gift: "gift.given",
    compliment: "compliment",
    insult: "insult",
    conflict: "conflict.resolved",
    betrayal: "betrayal",
    loan: "loan.repaid",
    favor: "favor.done",
    promotion: "promotion",
    demotion: "demotion",
    family_support: "family.support",
    family_conflict: "family.conflict",
  };

  const factorId = factorMap[signal.type];
  const factor = factorCatalog.getFactor(factorId);
  if (!factor) return null;

  // Prüfen ob Faktor im Kontext anwendbar ist
  if (!factor.applicableContexts.includes(context)) {
    return null;
  }

  // Kontext-Modifikator anwenden
  const modifier = factorCatalog.getContextModifier(context, factorId);

  // Rohwert in weightBps übersetzen
  let weightBps = Math.round(factor.baseWeightBps * intensity * modifier);

  // Bei negativen Werten (Beleidigung, Verrat etc.) ist ein höherer Wert schlimmer
  if (signal.type === "insult" || signal.type === "betrayal" || signal.type === "family_conflict") {
    weightBps = -Math.abs(weightBps);
  }

  // Auf maxApplicableScore begrenzen
  const maxScore = factor.maxApplicableScore;
  if (weightBps > 0 && weightBps > maxScore * 100) {
    weightBps = maxScore * 100;
  } else if (weightBps < 0 && weightBps < maxScore * 100) {
    weightBps = maxScore * 100;
  }

  return {
    factorId,
    weightBps,
    maxApplicableScore: maxScore,
    decayPerTick: factor.decayPerTick ?? ctx.worldTime.tick % 100 === 0 ? 1 : 0,
    sourceContext: context,
    source: `${signal.type}:${signal.value}`,
    appliedAtTick: worldTime.tick,
  };
}

/**
 * Übersetzt mehrere Signale gleichzeitig in Factors.
 * Gibt nur gültige (nicht-null) Factors zurück.
 */
export function normalizeSignals(
  signals: RawSocialSignal[],
  ctx: NormalizationContext
): NormalizedFactor[] {
  const factors: NormalizedFactor[] = [];
  for (const signal of signals) {
    const factor = normalizeSignal(signal, ctx);
    if (factor) {
      factors.push(factor);
    }
  }
  return factors;
}

/**
 * Wandelt NormalizedFactors in das Relationship.Factor-Format um.
 */
export function toRelationshipFactor(
  normalized: NormalizedFactor
): { id: string; weight: number; appliedAtTick: number } {
  return {
    id: normalized.factorId,
    weight: normalized.weightBps, // bps
    appliedAtTick: normalized.appliedAtTick,
  };
}

/**
 * Berechnet den Netto-Einfluss mehrerer Factors auf einen Score.
 * Wendet maxApplicableScore pro Faktor an und clamps das Ergebnis.
 */
export function calculateNetInfluence(
  factors: NormalizedFactor[],
  currentScore: number
): { newScore: number; totalWeightBps: number } {
  let totalWeightBps = 0;

  for (const f of factors) {
    // Jeder Faktor hat einen eigenen maxApplicableScore (in Score-Punkten, nicht bps)
    const absMaxBps = Math.abs(f.maxApplicableScore * 100);
    let weight = f.weightBps;

    // Auf den maxApplicableScore des Faktors begrenzen
    if (weight > absMaxBps) weight = absMaxBps;
    if (weight < -absMaxBps) weight = -absMaxBps;

    totalWeightBps += weight;
  }

  // bps in Score-Punkte umrechnen (100 bps = 1 Score-Punkt)
  const scoreChange = totalWeightBps / 100;
  const newScore = Math.max(-100, Math.min(100, currentScore + scoreChange));

  return { newScore, totalWeightBps };
}

/**
 * Wendet einen Faktor auf eine Beziehung an (reine Übersetzung, keine Mutation).
 */
export function applyFactorToRelationship(
  relationship: { score: number; disposition: string },
  factor: NormalizedFactor,
  currentTick: number
): { score: number; disposition: string; appliedFactor: FactorContribution } {
  const { newScore, totalWeightBps } = calculateNetInfluence(
    [factor],
    relationship.score
  );

  let disposition = relationship.disposition;
  if (newScore >= 75) disposition = "intimate";
  else if (newScore >= 25) disposition = "friendly";
  else if (newScore <= -25) disposition = "hostile";
  else disposition = "neutral";

  return {
    score: newScore,
    disposition,
    appliedFactor: {
      factorId: factor.factorId,
      weight: totalWeightBps,
      appliedAtTick: currentTick,
      sourceContext: factor.sourceContext,
      source: factor.source,
    },
  };
}