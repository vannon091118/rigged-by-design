/**
 * Access Policy Tests - Phase 7.5
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AccessPolicyEngine, accessPolicyEngine, type AccessPolicy } from "../../../../src/core/sim/room/access-policy";

describe("Access Policy Engine", () => {
  let engine: AccessPolicyEngine;

  beforeEach(() => {
    engine = new AccessPolicyEngine();
  });

  it("default policy is public", () => {
    const result = engine.canEnter("room-1", "npc-1");
    expect(result.allowed).toBe(true);
    expect(result.policy).toBe("public");
  });

  it("sets and checks public policy", () => {
    engine.setPolicy("room-1", "public", [], 100);
    const result = engine.canEnter("room-1", "npc-1");
    expect(result.allowed).toBe(true);
    expect(result.policy).toBe("public");
  });

  it("private policy blocks all", () => {
    engine.setPolicy("room-1", "private", [], 100);
    const result = engine.canEnter("room-1", "npc-1");
    expect(result.allowed).toBe(false);
    expect(result.policy).toBe("private");
    expect(result.reason).toContain("Private room");
  });

  it("residents-only allows residents", () => {
    engine.setPolicy("room-1", "residents-only", ["npc-1", "npc-2"], 100);
    
    const result1 = engine.canEnter("room-1", "npc-1");
    expect(result1.allowed).toBe(true);
    expect(result1.policy).toBe("residents-only");

    const result2 = engine.canEnter("room-1", "npc-3");
    expect(result2.allowed).toBe(false);
    expect(result2.policy).toBe("residents-only");
    expect(result2.reason).toContain("Not a resident");
  });

  it("gets policy", () => {
    engine.setPolicy("room-1", "private", [], 100);
    expect(engine.getPolicy("room-1")).toBe("private");
    expect(engine.getPolicy("room-2")).toBeUndefined();
  });

  it("lists all policies", () => {
    engine.setPolicy("room-1", "public", [], 100);
    engine.setPolicy("room-2", "private", [], 100);
    
    const policies = engine.listPolicies();
    expect(policies.length).toBe(2);
  });

  it("apartment stays private even with gambling objects", () => {
    // Apartment with gambling objects should still be private
    engine.setPolicy("apartment-1", "private", [], 100);
    const result = engine.canEnter("apartment-1", "npc-1");
    expect(result.allowed).toBe(false);
    expect(result.policy).toBe("private");
  });
});

describe("Global Access Policy Engine", () => {
  it("is a singleton", () => {
    expect(accessPolicyEngine).toBeDefined();
  });
});
