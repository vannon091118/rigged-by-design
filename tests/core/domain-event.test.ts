import { describe, it, expect } from "vitest";
import {
  createDomainEvent,
  isEventExpired,
  isEventResolved,
  DEFAULT_EVENT_CONTEXT,
} from "../../src/core/domain-event";

describe("Domain-Event contract", () => {
  it("has correct defaults", () => {
    expect(DEFAULT_EVENT_CONTEXT.maxPending).toBe(48);
    expect(DEFAULT_EVENT_CONTEXT.maxNewEventsPerTick).toBe(3);
    expect(DEFAULT_EVENT_CONTEXT.visitorCap).toBe(40);
    expect(DEFAULT_EVENT_CONTEXT.maxCandidates).toBe(64);
  });

  it("creates an event with deadline", () => {
    const evt = createDomainEvent(
      "evt-1",
      "visitor.arrived",
      "actor-1",
      { location: "lobby" },
      100,
      50
    );
    expect(evt.id).toBe("evt-1");
    expect(evt.deadlineTick).toBe(150);
    expect(evt.resolved).toBe(false);
  });

  it("detects expired events", () => {
    const evt = createDomainEvent(
      "evt-2",
      "guest.checked-in",
      "actor-2",
      {},
      100,
      10
    );
    expect(isEventExpired(evt, 110)).toBe(true);
    expect(isEventExpired(evt, 100)).toBe(false);
  });

  it("detects resolved events", () => {
    const evt = createDomainEvent("evt-3", "player.cash-changed", "actor-3", {}, 0, 100);
    expect(isEventResolved(evt)).toBe(false);
    const resolved = { ...evt, resolved: true };
    expect(isEventResolved(resolved)).toBe(true);
  });
});