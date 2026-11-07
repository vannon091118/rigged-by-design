import { describe, it, expect } from "vitest";
import {
  createActorId,
  actorIdEquals,
  actorIdToString,
} from "../../src/core/actor-id";

describe("ActorId contract", () => {
  it("creates a valid ActorId", () => {
    const id = createActorId("actor-1");
    expect(id.value).toBe("actor-1");
    expect(typeof id.brand).toBe("symbol");
  });

  it("rejects empty values", () => {
    expect(() => createActorId("")).toThrow();
    expect(() => createActorId("   ")).not.toThrow();
  });

  it("compares equality correctly", () => {
    const a = createActorId("x");
    const b = createActorId("x");
    const c = createActorId("y");
    expect(actorIdEquals(a, b)).toBe(true);
    expect(actorIdEquals(a, c)).toBe(false);
  });

  it("serializes to string", () => {
    expect(actorIdToString(createActorId("abc"))).toBe("abc");
  });
});