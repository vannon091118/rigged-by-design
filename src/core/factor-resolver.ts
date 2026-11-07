/**
 * Normalization Resolver — Phase 3.3
 * Reine Übersetzungsfunktionen pro Quelle wandeln Rohwerte in kontextabhängige
 * Factors um. Faktoren sind begrenzte normalisierte Werte; Beiträge werden als
 * signierte, deterministische Festkomma-Werte aggregiert und kontrolliert begrenzt.
 *
 * Keine versteckten Zufalls- oder Zeitabhängigkeiten. Gleiche Eingaben ergeben
 * stets identische Snapshots.
 */

import type { WorldTime } from "./sim/worldtime";
import type {
  FactorDefinition,
  FactorContribution,
  FactorContext,
} from "./factor-catalog";
import { factorCatalog } from "./factor-catalog";

// ──────────────────────────────────────────────────────────────────────────────
// Kontext-Typen
// ──────────────────────────────────────────────────────────────────────────────

export interface NormalizationContext {
  readonly actingActorId: string;     // handelnder Akteur
  readonly targetActorId?: string;    // Zielperson (optional, für zielbezogene Faktoren)
  readonly action: string;            // Handlung/Situation
  readonly situation: FactorContext;  // Kontext (casino, social, work, ...)
  readonly worldTime: WorldTime;      // Zeitpunkt
  readonly sourceId: string;          // stabile Quell-ID für Deduplizierung
}

export interface NormalizedValue {
  readonly value: number;   // -1.0 .. 1.0 (normalisiert)
  readonly confidence: number; // 0.0 .. 1.0 (Wie sicher ist die Normalisierung?)
  readonly sourceId: string;
  readonly appliedAtTick: number;
}

export interface ContributionTrace {
  readonly factorId: string;
  readonly sourceId: string;
  readonly rawValue: number;
  readonly normalizedValue: number;
  readonly weightBps: number;       // signierte Festkomma-Basis-Punkte
  readonly appliedAtTick: number;
  readonly context: FactorContext;
  readonly explanation: string;     // erklärbare Spur: warum dieser Wert?
}

export interface FactorSnapshot {
  readonly context: NormalizationContext;
  readonly contributions: ContributionTrace[];
  readonly totalWeightBps: number;  // aggregiert, kontrolliert begrenzt
  readonly normalizedScore: number; // -1.0 .. 1.0
  readonly appliedAtTick: number;
  readonly deterministic: boolean;  // immer true
}

// ──────────────────────────────────────────────────────────────────────────────
// Reine Normalisierungsfunktionen pro Quelle
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Normalisiert einen Stimmungswert (Mood) in den Bereich [-1.0, 1.0].
 * Rohwert: typischerweise -100 .. 100 oder 0 .. 100.
 */
export function normalizeMood(rawMood: number, ctx: NormalizationContext): NormalizedValue {
  const clamped = Math.max(-100, Math.min(100, rawMood));
  const normalized = clamped / 100; // -1.0 .. 1.0
  return {
    value: normalized,
    confidence: 1.0,
    sourceId: ctx.sourceId,
    appliedAtTick: ctx.worldTime.tick,
  };
}

/**
 * Normalisiert Geduld (Patience) in [-1.0, 1.0].
 * Hohe Geduld = positiver Wert, geringe Geduld = negativer Wert.
 * Rohwert: typischerweise 0 .. 100 (0 = keine Geduld, 100 = maximale Geduld).
 */
export function normalizePatience(rawPatience: number, ctx: NormalizationContext): NormalizedValue {
  const clamped = Math.max(0, Math.min(100, rawPatience));
  const normalized = (clamped - 50) / 50; // -1.0 .. 1.0, 50 = neutral
  return {
    value: normalized,
    confidence: 0.9,
    sourceId: ctx.sourceId,
    appliedAtTick: ctx.worldTime.tick,
  };
}

/**
 * Normalisiert Sucht/Abbhängigkeit (Addiction) in [-1.0, 1.0].
 * Hohe Sucht = negativer Einfluss auf rationale Entscheidungen.
 * Rohwert: typischerweise 0 .. 100 (0 = keine Sucht, 100 = maximale Sucht).
 */
export function normalizeAddiction(rawAddiction: number, ctx: NormalizationContext): NormalizedValue {
  const clamped = Math.max(0, Math.min(100, rawAddiction));
  const normalized = -(clamped / 100); // 0 = neutral, -1.0 = maximale Sucht
  return {
    value: normalized,
    confidence: 0.85,
    sourceId: ctx.sourceId,
    appliedAtTick: ctx.worldTime.tick,
  };
}

/**
 * Normalisiert einen Beziehungswert (Relationship) in [-1.0, 1.0].
 * Rohwert: typischerweise -100 .. 100 (Beziehungs-Score).
 */
export function normalizeRelationship(rawScore: number, ctx: NormalizationContext): NormalizedValue {
  const clamped = Math.max(-100, Math.min(100, rawScore));
  const normalized = clamped / 100; // -1.0 .. 1.0
  return {
    value: normalized,
    confidence: 1.0,
    sourceId: ctx.sourceId,
    appliedAtTick: ctx.worldTime.tick,
  };
}

/**
 * Normalisiert einen RPG-Wert (z. B. Charisma, Intelligenz, Geschick) in [-1.0, 1.0].
 * Rohwert: typischerweise 1 .. 100 oder 0 .. 100.
 */
export function normalizeRPGValue(rawValue: number, maxValue: number, ctx: NormalizationContext): NormalizedValue {
  const clamped = Math.max(0, Math.min(maxValue, rawValue));
  const normalized = (clamped / maxValue) * 2 - 1; // -1.0 .. 1.0
  return {
    value: normalized,
    confidence: 0.95,
    sourceId: ctx.sourceId,
    appliedAtTick: ctx.worldTime.tick,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Factor-Übersetzung: NormalizedValue → ContributionTrace
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Übersetzt einen normalisierten Wert in einen Factor-Beitrag (ContributionTrace).
 * Das Gewicht wird als signierte Festkomma-Basis-Punkte (bps) ausgedrückt.
 * maxWeightBps begrenzt den Einfluss kontrolliert.
 */
export function toContribution(
  factorId: string,
  normalized: NormalizedValue,
  ctx: NormalizationContext,
  maxWeightBps: number
): ContributionTrace {
  const factor = factorCatalog.getFactor(factorId);
  if (!factor) {
    throw new Error(`Unknown factor: ${factorId}`);
  }

  // Prüfen ob Faktor im Kontext anwendbar ist
  if (!factor.applicableContexts.includes(ctx.situation)) {
    throw new Error(`Factor ${factorId} not applicable in context ${ctx.situation}`);
  }

  // Kontext-Modifikator anwenden
  const modifier = factorCatalog.getContextModifier(ctx.situation, factorId);

  // Gewicht als signierte Festkomma-Basis-Punkte berechnen
  // value: -1.0 .. 1.0 → weightBps: -maxWeightBps .. maxWeightBps
  const weightBps = Math.round(normalized.value * maxWeightBps * modifier * 100) / 100;

  // Auf maxApplicableScore begrenzen (in bps umgerechnet)
  const maxBps = factor.maxApplicableScore * 100;
  const clampedWeight = Math.max(-maxBps, Math.min(maxBps, weightBps));

  const explanation = `${factorId}: raw→normalized(${normalized.value.toFixed(3)}) × modifier(${modifier.toFixed(2)}) × max(${maxWeightBps}bps) = ${clampedWeight}bps in ${ctx.situation}`;

  return {
    factorId,
    sourceId: normalized.sourceId,
    rawValue: normalized.value,
    normalizedValue: normalized.value,
    weightBps: clampedWeight,
    appliedAtTick: normalized.appliedAtTick,
    context: ctx.situation,
    explanation,
  };
}

/**
 * Aggregiert mehrere ContributionTraces zu einem Gesamt-Score.
 * Deterministische Reihenfolge, Deduplizierung nach sourceId, kontrollierte Begrenzung.
 */
export function aggregateContributions(
  contributions: ContributionTrace[],
  ctx: NormalizationContext
): FactorSnapshot {
  // Deduplizierung: gleiche sourceId wird nur einmal berücksichtigt (erste Instanz gewinnt)
  const seen = new Set<string>();
  const unique: ContributionTrace[] = [];

  // Stabile Reihenfolge: nach appliedAtTick, dann nach factorId
  const sorted = [...contributions].sort((a, b) => {
    if (a.appliedAtTick !== b.appliedAtTick) return a.appliedAtTick - b.appliedAtTick;
    return a.factorId.localeCompare(b.factorId);
  });

  for (const c of sorted) {
    if (seen.has(c.sourceId)) continue;
    seen.add(c.sourceId);
    unique.push(c);
  }

  // Aggregation: Summe aller weightBps, kontrolliert begrenzt
  let totalWeightBps = 0;
  for (const c of unique) {
    totalWeightBps += c.weightBps;
  }

  // Gesamte Begrenzung auf [-10000, 10000] bps (= -1.0 .. 1.0)
  const clampedTotal = Math.max(-10000, Math.min(10000, totalWeightBps));
  const normalizedScore = clampedTotal / 10000; // -1.0 .. 1.0

  return {
    context: ctx,
    contributions: unique,
    totalWeightBps: clampedTotal,
    normalizedScore,
    appliedAtTick: ctx.worldTime.tick,
    deterministic: true,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// PerceptionTranslator — Resolver-Consumer für Wahrnehmung
// ──────────────────────────────────────────────────────────────────────────────

export interface PerceptionContext extends NormalizationContext {
  readonly roomProfile?: string;   // Raumprofil (z. B. "casino-floor", "lounge")
  readonly persona?: string;       // Persona des Akteurs
  readonly traits?: string[];      // Traits des Akteurs
  readonly relationshipScore?: number; // bestehender Beziehungs-Score zum Ziel
}

/**
 * PerceptionTranslator übersetzt eine Wahrnehmung in Factor-Beiträge.
 * Er ist der Resolver-Consumer für weiche Simulationsentscheidungen.
 */
export class PerceptionTranslator {
  private readonly factorCatalogRef = factorCatalog;

  /**
   * Übersetzt eine Wahrnehmung in einen FactorSnapshot.
   * Reine Funktion — gleiche Eingaben ergeben identische Snapshots.
   */
  translatePerception(ctx: PerceptionContext): FactorSnapshot {
    const contributions: ContributionTrace[] = [];

    // Stimmung einbeziehen (wenn im Kontext verfügbar)
    const mood = this.extractMood(ctx);
    if (mood !== null) {
      contributions.push(
        toContribution("engagement", mood, ctx, 3000)
      );
    }

    // Beziehung zum Ziel einbeziehen (zielbezogener Faktor: rapport)
    if (ctx.targetActorId && ctx.relationshipScore !== undefined) {
      const relNorm = normalizeRelationship(ctx.relationshipScore, ctx);
      contributions.push(
        toContribution("rapport", relNorm, ctx, 4000)
      );
    }

    // Widerstand basierend auf Kontext
    const resistance = this.extractResistance(ctx);
    if (resistance !== null) {
      contributions.push(
        toContribution("resistance", resistance, ctx, 3000)
      );
    }

    // Soziale Offenheit
    const openness = this.extractSocialOpenness(ctx);
    if (openness !== null) {
      contributions.push(
        toContribution("socialOpenness", openness, ctx, 2000)
      );
    }

    // Compliance (Regelbefolgung)
    const compliance = this.extractCompliance(ctx);
    if (compliance !== null) {
      contributions.push(
        toContribution("compliance", compliance, ctx, 2500)
      );
    }

    return aggregateContributions(contributions, ctx);
  }

  private extractMood(ctx: PerceptionContext): NormalizedValue | null {
    // Mood wird aus dem Kontext abgeleitet (hier als Platzhalter aus Traits/Persona)
    // In einer echten Implementierung kommt dies aus dem Actor-State
    const baseMood = ctx.persona === "optimist" ? 30 : ctx.persona === "pessimist" ? -30 : 0;
    const traitAdjustment = ctx.traits?.includes("calm") ? 10 : ctx.traits?.includes("anxious") ? -10 : 0;
    const raw = Math.max(-100, Math.min(100, baseMood + traitAdjustment));
    return normalizeMood(raw, ctx);
  }

  private extractResistance(ctx: PerceptionContext): NormalizedValue | null {
    // Widerstand höher bei Konflikt-Kontext, niedriger bei Sozial-Kontext
    let raw = 0;
    if (ctx.situation === "conflict") raw = 40;
    if (ctx.situation === "casino") raw = 20;
    if (ctx.traits?.includes("stubborn")) raw += 20;
    if (ctx.traits?.includes("cooperative")) raw -= 20;
    return normalizeAddiction(-raw, ctx); // umgedreht: hoher Widerstand = negativer Wert
  }

  private extractSocialOpenness(ctx: PerceptionContext): NormalizedValue | null {
    let raw = 50; // neutral
    if (ctx.situation === "social") raw += 20;
    if (ctx.situation === "romantic") raw += 10;
    if (ctx.traits?.includes("introvert")) raw -= 30;
    if (ctx.traits?.includes("extrovert")) raw += 30;
    return normalizeMood(raw, ctx);
  }

  private extractCompliance(ctx: PerceptionContext): NormalizedValue | null {
    let raw = 60; // Standard-Compliance
    if (ctx.situation === "work") raw += 20;
    if (ctx.situation === "casino") raw -= 10;
    if (ctx.traits?.includes("rebellious")) raw -= 30;
    if (ctx.traits?.includes("lawful")) raw += 30;
    return normalizeMood(raw, ctx);
  }
}

export const perceptionTranslator = new PerceptionTranslator();

// ──────────────────────────────────────────────────────────────────────────────
// Convenience: komplette Übersetzung von Rohwerten zu Snapshot
// ──────────────────────────────────────────────────────────────────────────────

export function createNormalizationContext(
  actingActorId: string,
  action: string,
  situation: FactorContext,
  worldTime: WorldTime,
  sourceId: string,
  targetActorId?: string
): NormalizationContext {
  return {
    actingActorId,
    targetActorId,
    action,
    situation,
    worldTime,
    sourceId,
  };
}