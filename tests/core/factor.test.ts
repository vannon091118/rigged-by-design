import { describe, it, expect } from "vitest";
import { applyFactor } from "../../src/core/factor";

describe("Factor contract", () => {
  it("applies additive factors", () => {
    expect(applyFactor(100, [{ id: "f1", domain: "economy", operation: "add", baseValue: 25 }])).toBe(125);
  });

  it("applies multiplicative factors", () => {
    expect(applyFactor(100, [{ id: "f1", domain: "economy", operation: "multiply", baseValue: 1.5 }])).toBe(150);
  });

  it("applies multiple factors in order", () => {
    expect(
      applyFactor(100, [
        { id: "f1", domain: "economy", operation: "add", baseValue: 10 },
        { id: "f2", domain: "economy", operation: "multiply", baseValue: 2 },
      ])
    ).toBe(220);
  });

  it("returns base when no factors", () => {
    expect(applyFactor(42, [])).toBe(42);
  });
});