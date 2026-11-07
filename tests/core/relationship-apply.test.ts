import { describe, it, expect, beforeEach } from "vitest";
import {
  applyRelationshipEvent,
  applyRelationshipEvents,
  RELATIONSHIP_EVENT_TYPES,
  migrateLegacyRelationships,
  type RelationshipEventResult,
} from "../../src/core/relationship-apply.js";
import { actorRegistry } from "../../src/core/actor-registry.js";
import { createDomainEvent } from "../../src/core/domain-event.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";
import { RelationshipEngine } from "../../src/core/relationship-engine.js";

function makeEvent(
  type: string,
  actorId: string,
  payload: Record<string, unknown>,
  tick: number
): any {
  return createDomainEvent(
    `evt-${tick}`,
    type as any,
    actorId,
    payload,
    tick,
    100
  );
}

describe("Relationship Apply (Phase 3.1)", () => {
  beforeEach(() => {
    actorRegistry.registerIdentity("actor-1", "visitor", "Besucher", 0);
    actorRegistry.registerIdentity("actor-2", "visitor", "Besucher 2", 0);
    actorRegistry.registerIdentity("actor-3", "staff", "Mitarbeiter", 0);
  });

  it("applies a positive relationship event", () => {
    const event = makeEvent("gift.given", "actor-1", {
      targetActorId: "actor-2",
      delta: 50,
    }, 100);

    const result = applyRelationshipEvent(event);
    expect(result.ok).toBe(true);
    expect(result.edgesApplied).toBe(1);
  });

  it("applies a negative relationship event", () => {
    const event = makeEvent("insult", "actor-1", {
      targetActorId: "actor-2",
      delta: -40,
    }, 100);

    const result = applyRelationshipEvent(event);
    expect(result.ok).toBe(true);
    expect(result.edgesApplied).toBe(1);
  });

  it("rejects events with unknown actors", () => {
    const event = makeEvent("gift.given", "unknown-actor", {
      targetActorId: "actor-2",
      delta: 50,
    }, 100);

    const result = applyRelationshipEvent(event);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("ignores non-relationship events", () => {
    const event = makeEvent("visitor.arrived", "actor-1", {
      location: "lobby",
    }, 100);

    const result = applyRelationshipEvent(event);
    expect(result.ok).toBe(true);
    expect(result.edgesApplied).toBe(0);
  });

  it("applies multiple events atomically", () => {
    const events = [
      makeEvent("gift.given", "actor-1", { targetActorId: "actor-2", delta: 30 }, 100),
      makeEvent("insult", "actor-2", { targetActorId: "actor-1", delta: -20 }, 101),
    ];

    const result = applyRelationshipEvents(events);
    expect(result.ok).toBe(true);
    expect(result.edgesApplied).toBe(2);
  });

  it("migrates legacy relationships to directed edges", () => {
    const legacy = [
      { actorId: "actor-1", otherActorId: "actor-2", score: 80, disposition: "friendly" },
      { actorId: "actor-3", otherActorId: "actor-1", score: -40, disposition: "hostile" },
    ];

    const result = migrateLegacyRelationships(
      legacy,
      new RelationshipEngine(),
      createWorldTime(200)
    );

    expect(result.migrated).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("reports migration errors for unknown actors", () => {
    const legacy = [
      { actorId: "unknown", otherActorId: "actor-2", score: 50 },
    ];

    const result = migrateLegacyRelationships(
      legacy,
      new RelationshipEngine(),
      createWorldTime(200)
    );

    expect(result.migrated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
