import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSignal,
  normalizeSignals,
  toRelationshipFactor,
  calculateNetInfluence,
  applyFactorToRelationship,
  type NormalizationContext,
  type RawSocialSignal,
} from "../../src/core/factor-normalizer.js";
import { factorCatalog } from "../../src/core/factor-catalog.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";

function makeContext(overrides: Partial<NormalizationContext> = {}): NormalizationContext {
  return {
    context: "social",
    worldTime: createWorldTime(100),
    actorPair: ["actor-1", "actor-2"],
    ...overrides,
  };
}

describe("Factor Normalizer (Phase 3)", () => {
  it("normalizes a gift signal", () => {
    const ctx = makeContext();
    const signal: RawSocialSignal = { type: "gift", value: 100, intensity: 1.0 };
    const factor = normalizeSignal(signal, ctx);

    expect(factor).toBeDefined();
    expect(factor!.factorId).toBe("gift.given");
    expect(factor!.weightBps).toBeGreaterThan(0);
    expect(factor!.sourceContext).toBe("social");
  });

  it("normalizes an insult signal with negative weight", () => {
    const ctx = makeContext();
    const signal: RawSocialSignal = { type: "insult", value: 1, intensity: 1.0 };
    const factor = normalizeSignal(signal, ctx);

    expect(factor).toBeDefined();
    expect(factor!.factorId).toBe("insult");
    expect(factor!.weightBps).toBeLessThan(0);
  });

  it("applies context modifier (casino makes insult stronger)", () => {
    const socialCtx = makeContext({ context: "social" });
    const casinoCtx = makeContext({ context: "casino" });

    const socialFactor = normalizeSignal({ type: "insult", value: 1, intensity: 1.0 }, socialCtx);
    const casinoFactor = normalizeSignal({ type: "insult", value: 1, intensity: 1.0 }, casinoCtx);

    expect(socialFactor).toBeDefined();
    expect(casinoFactor).toBeDefined();
    if (socialFactor && casinoFactor) {
      // Casino modifier for insult is 1.5, social is 1.0 → more negative in casino
      expect(casinoFactor.weightBps).toBeLessThan(socialFactor.weightBps);
    }
  });

  it("rejects factor not applicable in context", () => {
    const ctx = makeContext({ context: "casino" });
    // "promotion" ist nur in "work" anwendbar, nicht in "casino"
    const factor = normalizeSignal({ type: "promotion", value: 1, intensity: 1.0 }, ctx);
    expect(factor).toBeNull();
  });

  it("normalizes multiple signals", () => {
    const ctx = makeContext();
    const signals: RawSocialSignal[] = [
      { type: "gift", value: 100, intensity: 1.0 },
      { type: "insult", value: 1, intensity: 1.0 },
      { type: "compliment", value: 1, intensity: 0.5 },
    ];
    const factors = normalizeSignals(signals, ctx);
    expect(factors.length).toBe(3);
  });

  it("converts normalized factor to relationship factor format", () => {
    const normalized = {
      factorId: "gift.given",
      weightBps: 500,
      maxApplicableScore: 30,
      decayPerTick: 1,
      sourceContext: "social" as const,
      source: "gift:100",
      appliedAtTick: 100,
    };
    const relFactor = toRelationshipFactor(normalized);
    expect(relFactor.id).toBe("gift.given");
    expect(relFactor.weight).toBe(500);
    expect(relFactor.appliedAtTick).toBe(100);
  });

  it("calculates net influence of multiple factors", () => {
    const factors = [
      {
        factorId: "gift.given",
        weightBps: 500,
        maxApplicableScore: 30,
        decayPerTick: 1,
        sourceContext: "social" as const,
        source: "gift:100",
        appliedAtTick: 100,
      },
      {
        factorId: "insult",
        weightBps: -300,
        maxApplicableScore: -25,
        decayPerTick: 1,
        sourceContext: "social" as const,
        source: "insult:1",
        appliedAtTick: 100,
      },
    ];

    const result = calculateNetInfluence(factors, 0);
    // (500 - 300) / 100 = 2
    expect(result.newScore).toBe(2);
    expect(result.totalWeightBps).toBe(200);
  });

  it("clamps score to [-100, 100]", () => {
    const factors = [
      {
        factorId: "gift.given",
        weightBps: 20000, // sehr hoch
        maxApplicableScore: 30,
        decayPerTick: 0,
        sourceContext: "social" as const,
        source: "gift:1000",
        appliedAtTick: 100,
      },
    ];

    const result = calculateNetInfluence(factors, 0);
    expect(result.newScore).toBeLessThanOrEqual(100);
  });

  it("applies factor to relationship and updates disposition", () => {
    const relationship = { score: 0, disposition: "neutral" as const };
    const factor = {
      factorId: "gift.given",
      weightBps: 3000,
      maxApplicableScore: 30,
      decayPerTick: 1,
      sourceContext: "social" as const,
      source: "gift:100",
      appliedAtTick: 100,
    };

    const result = applyFactorToRelationship(relationship, factor, 100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.disposition).toBe("friendly"); // score >= 25
    expect(result.appliedFactor.factorId).toBe("gift.given");
  });

  it("updates disposition to hostile for very negative score", () => {
    const relationship = { score: 0, disposition: "neutral" as const };
    const factor = {
      factorId: "betrayal",
      weightBps: -3000,
      maxApplicableScore: -50,
      decayPerTick: 0,
      sourceContext: "social" as const,
      source: "betrayal:1",
      appliedAtTick: 100,
    };

    const result = applyFactorToRelationship(relationship, factor, 100);
    expect(result.score).toBeLessThanOrEqual(-25);
    expect(result.disposition).toBe("hostile");
  });

  it("intensity affects weight", () => {
    const ctx = makeContext();
    const weak = normalizeSignal({ type: "gift", value: 100, intensity: 0.1 }, ctx);
    const strong = normalizeSignal({ type: "gift", value: 100, intensity: 1.0 }, ctx);

    expect(weak!.weightBps).toBeLessThan(strong!.weightBps);
  });

  it("unknown signal type returns null", () => {
    const ctx = makeContext();
    const factor = normalizeSignal({ type: "unknown", value: 1, intensity: 1.0 } as any, ctx);
    expect(factor).toBeNull();
  });

  it("is a pure function — no side effects", () => {
    const ctx = makeContext();
    const signal: RawSocialSignal = { type: "gift", value: 100, intensity: 1.0 };
    normalizeSignal(signal, ctx);
    const factor = factorCatalog.getFactor("gift.given");
    expect(factor).toBeDefined();
    expect(factor!.baseWeightBps).toBe(500);
  });
});
