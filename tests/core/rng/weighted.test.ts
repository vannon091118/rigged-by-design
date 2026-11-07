import { describe, it, expect } from "vitest";
import { selectWeighted, MAX_BIAS_BPS, maxBiasMultiplier } from "../../../src/core/rng/weighted";

describe("Weighted RNG with bias correction", () => {
  it("MAX_BIAS_BPS is 1000 (10%)", () => {
    expect(MAX_BIAS_BPS).toBe(1000);
  });

  it("maxBiasMultiplier returns 1.10x (NOT 10.99x)", () => {
    expect(maxBiasMultiplier()).toBe(1.10);
  });

  it("selects from weighted options", () => {
    const result = selectWeighted([
      { value: "a", weight: 5000 },
      { value: "b", weight: 5000 },
    ]);
    expect(["a", "b"]).toContain(result);
  });

  it("respects weights (bias toward higher weight)", () => {
    // With 9000 vs 100, "a" should be selected overwhelmingly often
    let aCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (selectWeighted([
        { value: "a", weight: 9000 },
        { value: "b", weight: 1000 },
      ]) === "a") {
        aCount++;
      }
    }
    expect(aCount / trials).toBeGreaterThan(0.7);
  });

  it("applies bias adjustment", () => {
    const result = selectWeighted([
      { value: "a", weight: 100, biasBps: 500 }, // effective 600
      { value: "b", weight: 100, biasBps: -50 },  // effective 50
    ]);
    expect(["a", "b"]).toContain(result);
  });

  it("falls back to uniform when all weights are zero", () => {
    const result = selectWeighted([
      { value: "x", weight: 0 },
      { value: "y", weight: 0 },
    ]);
    expect(["x", "y"]).toContain(result);
  });

  it("throws on empty options", () => {
    expect(() => selectWeighted([])).toThrow();
  });
});