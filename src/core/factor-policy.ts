/**
 * Factor Policies — Phase 3.4
 * Weiche Simulationsentscheidungen basieren ausschließlich auf kontextbezogenen
 * Faktoren. Harte Bedingungen (Geld, Verfügbarkeit, Ausschluss, Fristen,
 * Settlement, zwingende Zustandsübergänge) bleiben separat und exakt.
 */

import type { FactorSnapshot } from "./factor-resolver";
import type { WorldTime } from "./sim/worldtime";

// ──────────────────────────────────────────────────────────────────────────────
// Policy-Ergebnisse
// ──────────────────────────────────────────────────────────────────────────────

export interface PolicyDecision {
  readonly decision: string;
  readonly allowed: boolean;
  readonly confidence: number; // 0.0 .. 1.0
  readonly factorSnapshot: FactorSnapshot;
  readonly reason: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Harte Bedingungen (unveränderlich, exakt)
// ──────────────────────────────────────────────────────────────────────────────

export interface HardCondition {
  readonly type: "money" | "availability" | "exclusion" | "deadline" | "settlement" | "mandatory";
  readonly check: () => boolean;
  readonly reason: string;
}

export function checkHardConditions(conditions: HardCondition[]): {
  readonly passed: boolean;
  readonly failedReason?: string;
} {
  for (const c of conditions) {
    if (!c.check()) {
      return { passed: false, failedReason: c.reason };
    }
  }
  return { passed: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Policy: Aktivitätswahl (Activity Choice)
// Verwendet nur: engagement, socialOpenness, capability
// ──────────────────────────────────────────────────────────────────────────────

export function activityChoicePolicy(
  snapshot: FactorSnapshot,
  availableActivities: string[],
  minEngagement: number = 0.3
): PolicyDecision {
  const engagementContrib = snapshot.contributions.find((c) => c.factorId === "engagement");
  const opennessContrib = snapshot.contributions.find((c) => c.factorId === "socialOpenness");
  const capabilityContrib = snapshot.contributions.find((c) => c.factorId === "capability");

  const engagementScore = engagementContrib?.weightBps / 10000 ?? 0;
  const opennessScore = opennessContrib?.weightBps / 10000 ?? 0;
  const capabilityScore = capabilityContrib?.weightBps / 10000 ?? 0;

  const combined = (engagementScore + opennessScore + capabilityScore) / 3;
  const allowed = combined >= minEngagement && availableActivities.length > 0;

  return {
    decision: "activityChoice",
    allowed,
    confidence: Math.abs(combined),
    factorSnapshot: snapshot,
    reason: allowed
      ? `Engagement=${engagementScore.toFixed(2)}, Offenheit=${opennessScore.toFixed(2)}, Fähigkeit=${capabilityScore.toFixed(2)} → ausreichend`
      : `Kombinierter Score=${combined.toFixed(2)} unter Mindestwert ${minEngagement}`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Policy: Angebotsbewertung (Offer Evaluation)
// Verwendet nur: rapport, compliance, resistance
// ──────────────────────────────────────────────────────────────────────────────

export function offerEvaluationPolicy(
  snapshot: FactorSnapshot,
  offerValue: number,
  minAcceptance: number = 0.4
): PolicyDecision {
  const rapportContrib = snapshot.contributions.find((c) => c.factorId === "rapport");
  const complianceContrib = snapshot.contributions.find((c) => c.factorId === "compliance");
  const resistanceContrib = snapshot.contributions.find((c) => c.factorId === "resistance");

  const rapportScore = rapportContrib?.weightBps / 10000 ?? 0;
  const complianceScore = complianceContrib?.weightBps / 10000 ?? 0;
  const resistanceScore = resistanceContrib?.weightBps / 10000 ?? 0;

  // Hoher Widerstand senkt Akzeptanz, hoher Rapport und Compliance erhöhen sie
  const acceptance = (rapportScore + complianceScore - resistanceScore) / 3;
  const allowed = acceptance >= minAcceptance;

  return {
    decision: "offerEvaluation",
    allowed,
    confidence: Math.abs(acceptance),
    factorSnapshot: snapshot,
    reason: allowed
      ? `Rapport=${rapportScore.toFixed(2)}, Compliance=${complianceScore.toFixed(2)}, Widerstand=${resistanceScore.toFixed(2)} → Angebot akzeptabel`
      : `Akzeptanz=${acceptance.toFixed(2)} unter Mindestwert ${minAcceptance}`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Policy: Rückkehrwahrscheinlichkeit (Return Probability)
// Verwendet nur: rapport, tension, engagement
// ──────────────────────────────────────────────────────────────────────────────

export function returnProbabilityPolicy(
  snapshot: FactorSnapshot,
  baseProbability: number = 0.5
): PolicyDecision {
  const rapportContrib = snapshot.contributions.find((c) => c.factorId === "rapport");
  const tensionContrib = snapshot.contributions.find((c) => c.factorId === "tension");
  const engagementContrib = snapshot.contributions.find((c) => c.factorId === "engagement");

  const rapportScore = rapportContrib?.weightBps / 10000 ?? 0;
  const tensionScore = tensionContrib?.weightBps / 10000 ?? 0;
  const engagementScore = engagementContrib?.weightBps / 10000 ?? 0;

  // Hohe Spannung senkt Rückkehr, hohes Engagement und Rapport erhöhen sie
  const adjusted = baseProbability + rapportScore * 0.3 - tensionScore * 0.3 + engagementScore * 0.2;
  const clamped = Math.max(0, Math.min(1, adjusted));

  return {
    decision: "returnProbability",
    allowed: clamped > 0,
    confidence: clamped,
    factorSnapshot: snapshot,
    reason: `Rückkehrwahrscheinlichkeit=${clamped.toFixed(2)} (Basis=${baseProbability})`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Policy: Soziale Reaktion (Social Reaction)
// Verwendet nur: sympathy, trust, conflict, influence (aus Relationship Engine)
// ──────────────────────────────────────────────────────────────────────────────

export interface SocialReactionInput {
  readonly trust: number;       // -100 .. 100
  readonly sympathy: number;    // -100 .. 100
  readonly conflict: number;    // -100 .. 100
  readonly influence: number;   // -100 .. 100
}

export function socialReactionPolicy(
  input: SocialReactionInput,
  snapshot: FactorSnapshot
): PolicyDecision {
  const avgScore = (input.trust + input.sympathy - input.conflict + input.influence) / 4;
  const normalized = avgScore / 100; // -1.0 .. 1.0

  const allowed = normalized >= 0; // positive Reaktion bei nicht-negativem Score

  return {
    decision: "socialReaction",
    allowed,
    confidence: Math.abs(normalized),
    factorSnapshot: snapshot,
    reason: allowed
      ? `Positiver sozialer Score=${avgScore.toFixed(1)} → positive Reaktion`
      : `Negativer sozialer Score=${avgScore.toFixed(1)} → negative Reaktion`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Registry der erlaubten Factor-Consumer-Bereiche
// Für Architektur-Tests: welche Bereiche dürfen auf Faktoren zugreifen?
// ──────────────────────────────────────────────────────────────────────────────

export const ALLOWED_FACTOR_CONSUMERS = [
  "activityChoicePolicy",
  "offerEvaluationPolicy",
  "returnProbabilityPolicy",
  "socialReactionPolicy",
] as const;

export type AllowedFactorConsumer = (typeof ALLOWED_FACTOR_CONSUMERS)[number];

// ──────────────────────────────────────────────────────────────────────────────
// Raw Value Access Detection (Architektur-Test-Hilfsfunktion)
// Erlaubt keinen direkten Zugriff auf Rohwerte in Factor-Consumer-Bereichen.
// Alle weichen Entscheidungen müssen über FactorSnapshot gehen.
// ──────────────────────────────────────────────────────────────────────────────

export interface RawValueAccess {
  readonly file: string;
  readonly line: number;
  readonly variable: string;
  readonly context: string;
}

/**
 * Prüft ob ein Code-Bereich unerlaubten direkten Rohwertzugriff enthält.
 * Dies ist eine Hilfsfunktion für Architektur-Tests; die tatsächliche
 * Prüfung erfolgt statisch durch den Test.
 */
export function assertNoRawValueAccess(
  code: string,
  allowedPatterns: string[] = []
): { ok: boolean; violations: RawValueAccess[] } {
  const violations: RawValueAccess[] = [];

  // Muster für unerlaubten direkten Zugriff auf Rohwerte in Consumer-Bereichen
  const rawValuePatterns = [
    /\brawValue\b/,
    /\brawScore\b/,
    /\brawMood\b/,
    /\brawPatience\b/,
    /\brawAddiction\b/,
    /\b\.balance\b(?!\s*[<>=!])/, // direkte Kontostand-Abfragen ohne Hard Condition
    /\b\.score\b(?!\s*[<>=!])/,   // direkte Beziehungs-Score-Abfragen
  ];

  const lines = code.split("\n");
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    for (const pattern of rawValuePatterns) {
      if (pattern.test(line)) {
        // Prüfen ob die Zeile in einem erlaubten Muster ist
        const isAllowed = allowedPatterns.some((p) => new RegExp(p).test(line));
        if (!isAllowed) {
          violations.push({
            file: "unknown",
            line: lineNum,
            variable: line.trim(),
            context: "raw value access in factor consumer",
          });
        }
      }
    }
  });

  return { ok: violations.length === 0, violations };
}