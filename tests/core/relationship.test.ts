import { describe, it, expect } from "vitest";
import {
  createRelationship,
  applyFactor,
  type Disposition,
} from "../../src/core/relationship";

describe("Relationship contract", () => {
  it("creates neutral relationship", () => {
    const rel = createRelationship("actor-1");
    expect(rel.disposition).toBe("neutral");
    expect(rel.score).toBe(0);
  });

  it("applies positive factor", () => {
    const rel = createRelationship("actor-1", "neutral", 0);
    const updated = applyFactor(rel, { id: "gift", weight: 5000, appliedAtTick: 10 }, 10);
    expect(updated.score).toBe(50);
    expect(updated.disposition).toBe("friendly");
    expect(updated.lastUpdatedTick).toBe(10);
  });

  it("clamps score to [-100, 100]", () => {
    const rel = createRelationship("actor-1", "neutral", 90);
    const updated = applyFactor(rel, { id: "big-gift", weight: 20000, appliedAtTick: 10 }, 10);
    expect(updated.score).toBe(100);
  });

  it("applies negative factor", () => {
    const rel = createRelationship("actor-1", "neutral", 0);
    const updated = applyFactor(rel, { id: "insult", weight: -3000, appliedAtTick: 5 }, 5);
    expect(updated.score).toBe(-30);
    expect(updated.disposition).toBe("hostile");
  });

  it("supports all dispositions", () => {
    const dispositions: Disposition[] = ["hostile", "neutral", "friendly", "intimate"];
    expect(dispositions).toHaveLength(4);
  });
});