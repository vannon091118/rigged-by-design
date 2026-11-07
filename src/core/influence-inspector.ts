/**
 * Influence Inspector — Phase 6
 * Zeigt den Einfluss von Faktoren auf Beziehungen und Entscheidungen.
 * Macht Contribution-Traces sichtbar und erklärt, warum bestimmte Werte zustande kamen.
 */

import type { ContributionTrace, FactorSnapshot, NormalizationContext } from "./factor-resolver";

export interface InfluenceFactor {
  readonly factorId: string;
  readonly weightBps: number;
  readonly normalizedValue: number;
  readonly explanation: string;
  readonly context: string;
  readonly appliedAtTick: number;
  readonly impact: "strong-positive" | "positive" | "neutral" | "negative" | "strong-negative";
}

export interface InfluenceAnalysis {
  readonly factorId: string;
  readonly totalWeightBps: number;
  readonly normalizedScore: number;
  readonly factors: InfluenceFactor[];
  readonly dominantFactor: InfluenceFactor | null;
  readonly appliedAtTick: number;
  readonly context: NormalizationContext;
  readonly deterministic: boolean;
}

export function analyzeInfluence(snapshot: FactorSnapshot): InfluenceAnalysis {
  const factors: InfluenceFactor[] = snapshot.contributions.map((c) => {
    let impact: InfluenceFactor["impact"];
    const absWeight = Math.abs(c.weightBps);
    if (absWeight >= 3000) impact = c.weightBps > 0 ? "strong-positive" : "strong-negative";
    else if (absWeight >= 1500) impact = c.weightBps > 0 ? "positive" : "negative";
    else impact = "neutral";

    return {
      factorId: c.factorId,
      weightBps: c.weightBps,
      normalizedValue: c.normalizedValue,
      explanation: c.explanation,
      context: c.context,
      appliedAtTick: c.appliedAtTick,
      impact,
    };
  });

  // Sortiere nach absolutem Gewicht absteigend
  factors.sort((a, b) => Math.abs(b.weightBps) - Math.abs(a.weightBps));

  const dominantFactor = factors.length > 0 ? factors[0] : null;

  return {
    factorId: "aggregate",
    totalWeightBps: snapshot.totalWeightBps,
    normalizedScore: snapshot.normalizedScore,
    factors,
    dominantFactor,
    appliedAtTick: snapshot.appliedAtTick,
    context: snapshot.context,
    deterministic: snapshot.deterministic,
  };
}

export function renderInfluenceAnalysis(analysis: InfluenceAnalysis): string {
  const factorsHtml = analysis.factors
    .map(
      (f) => `
        <div class="influence-factor" data-impact="${f.impact}">
          <span class="factor-name">${f.factorId}</span>
          <span class="factor-weight">${f.weightBps > 0 ? "+" : ""}${f.weightBps}bps</span>
          <span class="factor-impact">${f.impact}</span>
          <span class="factor-explanation">${f.explanation}</span>
        </div>
      `
    )
    .join("");

  return `
    <div class="influence-analysis" data-deterministic="${analysis.deterministic}">
      <div class="influence-summary">
        <span>Gesamt: ${analysis.totalWeightBps}bps</span>
        <span>Score: ${analysis.normalizedScore.toFixed(2)}</span>
        <span>Dominant: ${analysis.dominantFactor?.factorId ?? "none"}</span>
      </div>
      <div class="influence-factors">${factorsHtml}</div>
    </div>
  `;
}

export function renderInfluenceFactor(factor: InfluenceFactor): string {
  const impactColors: Record<InfluenceFactor["impact"], string> = {
    "strong-positive": "#4caf50",
    positive: "#8bc34a",
    neutral: "#ffc107",
    negative: "#ff5722",
    "strong-negative": "#f44336",
  };

  return `
    <div class="influence-factor-item" style="border-left-color: ${impactColors[factor.impact]}">
      <strong>${factor.factorId}</strong>
      <span>${factor.weightBps > 0 ? "+" : ""}${factor.weightBps} bps</span>
      <span>${factor.context}</span>
      <span>${factor.explanation}</span>
    </div>
  `;
}