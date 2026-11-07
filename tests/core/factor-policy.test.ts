import { describe, it, expect, beforeEach } from "vitest";
import {
  activityChoicePolicy,
  offerEvaluationPolicy,
  returnProbabilityPolicy,
  socialReactionPolicy,
  checkHardConditions,
  ALLOWED_FACTOR_CONSUMERS,
  assertNoRawValueAccess,
  type PolicyDecision,
} from "../../src/core/factor-policy.js";
import { createNormalizationContext, perceptionTranslator } from "../../src/core/factor-resolver.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";

function makeSnapshot(overrides: Partial<any> = {}): any {
  const ctx = createNormalizationContext(
    "actor-1",
    "test-action",
    "social",
    createWorldTime(100),
    "test-source"
  );
  return perceptionTranslator.translatePerception(ctx as any);
}

describe("Factor Policies - Phase 3.4", () => {
  describe("activityChoicePolicy", () => {
    it("allows activity when engagement, openness, capability are high", () => {
      const ctx = createNormalizationContext("a", "dance", "social", createWorldTime(100), "s1");
      // Manuell einen Snapshot mit hohen Werten erstellen
      const snapshot = {
        context: ctx,
        contributions: [
          { factorId: "engagement", weightBps: 6000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.6, normalizedValue: 0.6 },
          { factorId: "socialOpenness", weightBps: 5000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.5, normalizedValue: 0.5 },
          { factorId: "capability", weightBps: 7000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.7, normalizedValue: 0.7 },
        ],
        totalWeightBps: 18000,
        normalizedScore: 0.6,
        appliedAtTick: 100,
        deterministic: true,
      } as any;

      const result = activityChoicePolicy(snapshot, ["dance", "talk"], 0.3);
      expect(result.allowed).toBe(true);
      expect(result.decision).toBe("activityChoice");
    });

    it("rejects activity when combined score too low", () => {
      const ctx = createNormalizationContext("a", "dance", "social", createWorldTime(100), "s1");
      const snapshot = {
        context: ctx,
        contributions: [
          { factorId: "engagement", weightBps: 1000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.1, normalizedValue: 0.1 },
          { factorId: "socialOpenness", weightBps: 1000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.1, normalizedValue: 0.1 },
          { factorId: "capability", weightBps: 1000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.1, normalizedValue: 0.1 },
        ],
        totalWeightBps: 3000,
        normalizedScore: 0.1,
        appliedAtTick: 100,
        deterministic: true,
      } as any;

      const result = activityChoicePolicy(snapshot, ["dance"], 0.5);
      expect(result.allowed).toBe(false);
    });

    it("rejects when no activities available", () => {
      const ctx = createNormalizationContext("a", "dance", "social", createWorldTime(100), "s1");
      const snapshot = {
        context: ctx,
        contributions: [],
        totalWeightBps: 0,
        normalizedScore: 0,
        appliedAtTick: 100,
        deterministic: true,
      } as any;

      const result = activityChoicePolicy(snapshot, [], 0.3);
      expect(result.allowed).toBe(false);
    });
  });

  describe("offerEvaluationPolicy", () => {
    it("accepts offer with high rapport, compliance, low resistance", () => {
      const ctx = createNormalizationContext("a", "offer", "social", createWorldTime(100), "s1");
      const snapshot = {
        context: ctx,
        contributions: [
          { factorId: "rapport", weightBps: 6000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.6, normalizedValue: 0.6 },
          { factorId: "compliance", weightBps: 5000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.5, normalizedValue: 0.5 },
          { factorId: "resistance", weightBps: -2000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: -0.2, normalizedValue: -0.2 },
        ],
        totalWeightBps: 9000,
        normalizedScore: 0.3,
        appliedAtTick: 100,
        deterministic: true,
      } as any;

      const result = offerEvaluationPolicy(snapshot, 100, 0.4);
      expect(result.allowed).toBe(true);
      expect(result.decision).toBe("offerEvaluation");
    });

    it("rejects offer with high resistance", () => {
      const ctx = createNormalizationContext("a", "offer", "social", createWorldTime(100), "s1");
      const snapshot = {
        context: ctx,
        contributions: [
          { factorId: "rapport", weightBps: 1000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.1, normalizedValue: 0.1 },
          { factorId: "compliance", weightBps: 1000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.1, normalizedValue: 0.1 },
          { factorId: "resistance", weightBps: 8000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.8, normalizedValue: 0.8 },
        ],
        totalWeightBps: 10000,
        normalizedScore: 0.33,
        appliedAtTick: 100,
        deterministic: true,
      } as any;

      const result = offerEvaluationPolicy(snapshot, 100, 0.5);
      expect(result.allowed).toBe(false);
    });
  });

  describe("returnProbabilityPolicy", () => {
    it("calculates return probability with rapport and engagement", () => {
      const ctx = createNormalizationContext("a", "return", "social", createWorldTime(100), "s1");
      const snapshot = {
        context: ctx,
        contributions: [
          { factorId: "rapport", weightBps: 5000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.5, normalizedValue: 0.5 },
          { factorId: "tension", weightBps: -1000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: -0.1, normalizedValue: -0.1 },
          { factorId: "engagement", weightBps: 3000, sourceId: "s1", appliedAtTick: 100, context: "social", explanation: "test", rawValue: 0.3, normalizedValue: 0.3 },
        ],
        totalWeightBps: 7000,
        normalizedScore: 0.23,
        appliedAtTick: 100,
        deterministic: true,
      } as any;

      const result = returnProbabilityPolicy(snapshot, 0.5);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.decision).toBe("returnProbability");
    });
  });

  describe("socialReactionPolicy", () => {
    it("positive reaction with high trust and sympathy", () => {
      const result = socialReactionPolicy(
        { trust: 80, sympathy: 60, conflict: -10, influence: 20 },
        { context: createNormalizationContext("a", "react", "social", createWorldTime(100), "s1"), contributions: [], totalWeightBps: 0, normalizedScore: 0, appliedAtTick: 100, deterministic: true } as any
      );
      expect(result.allowed).toBe(true);
      expect(result.decision).toBe("socialReaction");
    });

    it("negative reaction with high conflict", () => {
      const result = socialReactionPolicy(
        { trust: -50, sympathy: -30, conflict: 80, influence: -20 },
        { context: createNormalizationContext("a", "react", "social", createWorldTime(100), "s1"), contributions: [], totalWeightBps: 0, normalizedScore: 0, appliedAtTick: 100, deterministic: true } as any
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe("Hard Conditions", () => {
    it("passes when all conditions met", () => {
      const conditions = [
        { type: "money" as const, check: () => true, reason: "sufficient funds" },
        { type: "availability" as const, check: () => true, reason: "available" },
      ];
      const result = checkHardConditions(conditions);
      expect(result.passed).toBe(true);
    });

    it("fails when any condition fails", () => {
      const conditions = [
        { type: "money" as const, check: () => true, reason: "sufficient funds" },
        { type: "exclusion" as const, check: () => false, reason: "excluded from area" },
      ];
      const result = checkHardConditions(conditions);
      expect(result.passed).toBe(false);
      expect(result.failedReason).toBe("excluded from area");
    });
  });

  describe("Allowed Factor Consumers", () => {
    it("lists all allowed consumers", () => {
      expect(ALLOWED_FACTOR_CONSUMERS).toContain("activityChoicePolicy");
      expect(ALLOWED_FACTOR_CONSUMERS).toContain("offerEvaluationPolicy");
      expect(ALLOWED_FACTOR_CONSUMERS).toContain("returnProbabilityPolicy");
      expect(ALLOWED_FACTOR_CONSUMERS).toContain("socialReactionPolicy");
      expect(ALLOWED_FACTOR_CONSUMERS.length).toBe(4);
    });
  });

  describe("Raw Value Access Detection", () => {
    it("detects raw value access in code", () => {
      const code = `
        const rawValue = actor.mood;
        if (rawValue > 50) { doSomething(); }
      `;
      const result = assertNoRawValueAccess(code);
      expect(result.ok).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("allows code without raw value access", () => {
      const code = `
        const snapshot = perceptionTranslator.translatePerception(ctx);
        const decision = activityChoicePolicy(snapshot, activities, 0.3);
      `;
      const result = assertNoRawValueAccess(code);
      expect(result.ok).toBe(true);
    });

    it("respects allowed patterns", () => {
      const code = `
        const computeResult = computeInternalValue();
        // allowedPattern matches this line
      `;
      const result = assertNoRawValueAccess(code, [/allowedPattern/]);
      expect(result.ok).toBe(true);
    });
  });
});
