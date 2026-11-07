import { describe, it, expect } from "vitest";
import {
  FactorCatalog,
  factorCatalog,
  DEFAULT_FACTOR_CATALOG,
  type FactorDefinition,
  type FactorCategory,
  type FactorContext,
} from "../../src/core/factor-catalog.js";

describe("Factor Catalog (Phase 3)", () => {
  it("has default factors registered", () => {
    expect(DEFAULT_FACTOR_CATALOG.length).toBeGreaterThan(0);
  });

  it("lists all factors", () => {
    const factors = factorCatalog.listFactors();
    expect(factors.length).toBeGreaterThan(0);
  });

  it("gets a factor by id", () => {
    const factor = factorCatalog.getFactor("gift.given");
    expect(factor).toBeDefined();
    expect(factor!.id).toBe("gift.given");
    expect(factor!.category).toBe("social");
  });

  it("returns undefined for unknown factor", () => {
    expect(factorCatalog.getFactor("unknown.factor")).toBeUndefined();
  });

  it("registers a new factor", () => {
    const catalog = new FactorCatalog();
    const result = catalog.registerFactor({
      id: "test.factor",
      category: "social",
      label: "Test Factor",
      description: "A test factor",
      baseWeightBps: 100,
      applicableContexts: ["social"],
      maxApplicableScore: 10,
    });
    expect(result.ok).toBe(true);
    expect(catalog.getFactor("test.factor")).toBeDefined();
  });

  it("rejects duplicate factor registration", () => {
    const result = factorCatalog.registerFactor({
      id: "gift.given",
      category: "social",
      label: "Duplicate",
      description: "Duplicate",
      baseWeightBps: 100,
      applicableContexts: ["social"],
      maxApplicableScore: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already registered");
  });

  it("rejects factor with out-of-range weight", () => {
    const catalog = new FactorCatalog();
    const result = catalog.registerFactor({
      id: "bad.factor",
      category: "social",
      label: "Bad",
      description: "Bad weight",
      baseWeightBps: 15000, // > 10000
      applicableContexts: ["social"],
      maxApplicableScore: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("out of range");
  });

  it("lists factors by category", () => {
    const social = factorCatalog.listFactorsByCategory("social");
    expect(social.length).toBeGreaterThan(0);
    for (const f of social) {
      expect(f.category).toBe("social");
    }
  });

  it("lists factors by context", () => {
    const casino = factorCatalog.listFactorsByContext("casino");
    expect(casino.length).toBeGreaterThan(0);
    for (const f of casino) {
      expect(f.applicableContexts).toContain("casino");
    }
  });

  it("gets context modifier", () => {
    const modifier = factorCatalog.getContextModifier("casino", "gift.given");
    expect(modifier).toBe(1.2);
  });

  it("returns 1.0 for unknown modifier", () => {
    const modifier = factorCatalog.getContextModifier("casino", "unknown.factor");
    expect(modifier).toBe(1.0);
  });

  it("sets context modifier", () => {
    const catalog = new FactorCatalog(DEFAULT_FACTOR_CATALOG);
    catalog.setContextModifier("casino", "insult", 2.0);
    expect(catalog.getContextModifier("casino", "insult")).toBe(2.0);
  });

  it("default catalog has factors for all main categories", () => {
    const categories: FactorCategory[] = [
      "social",
      "economic",
      "emotional",
      "reputational",
      "familial",
      "professional",
    ];
    for (const cat of categories) {
      const factors = factorCatalog.listFactorsByCategory(cat);
      expect(factors.length).toBeGreaterThan(0);
    }
  });

  it("default catalog has factors for all main contexts", () => {
    const contexts: FactorContext[] = [
      "casino",
      "social",
      "work",
      "everyday",
      "romantic",
      "conflict",
    ];
    for (const ctx of contexts) {
      const factors = factorCatalog.listFactorsByContext(ctx);
      expect(factors.length).toBeGreaterThan(0);
    }
  });

  it("factor weight range is valid", () => {
    for (const f of DEFAULT_FACTOR_CATALOG) {
      expect(Math.abs(f.baseWeightBps)).toBeLessThanOrEqual(10000);
    }
  });
});
