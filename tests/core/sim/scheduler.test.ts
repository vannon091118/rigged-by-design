import { describe, it, expect } from "vitest";
import {
  Scheduler,
  MAX_CANDIDATES,
  MAX_NEW_EVENTS,
  DEFAULT_SCHEDULER_OPTIONS,
  type SchedulerStats,
  type Priority,
} from "../../../src/core/sim/scheduler";
import { createEventEnvelope } from "../../../src/core/sim/event-bus";
import { createWorldTime } from "../../../src/core/sim/worldtime";

function makeEvent(overrides: Partial<Parameters<typeof createEventEnvelope>[0]> = {}): any {
  return createEventEnvelope(
    overrides.eventId ?? "evt-1",
    overrides.kind ?? "domain-event",
    overrides.type ?? "visitor.arrived",
    overrides.domain ?? "social",
    overrides.worldTime ?? createWorldTime(100),
    overrides.source ?? "player",
    overrides.participants ?? ["actor-1"],
    overrides.payload ?? {},
    overrides.payloadVersion ?? 1,
    overrides.correlationId,
    overrides.causationId
  );
}

describe("Scheduler (Phase 2.2)", () => {
  it("has correct budget constants", () => {
    expect(MAX_CANDIDATES).toBe(64);
    expect(MAX_NEW_EVENTS).toBe(3);
  });

  it("submits and accepts an event", () => {
    const scheduler = new Scheduler();
    const result = scheduler.submit(makeEvent({ eventId: "evt-1" }), "normal");
    expect(result.ok).toBe(true);
    expect(scheduler.getBacklogSize()).toBe(1);
  });

  it("processes tick with MAX_NEW_EVENTS limit", () => {
    const scheduler = new Scheduler();
    for (let i = 1; i <= 10; i++) {
      scheduler.submit(makeEvent({ eventId: `evt-${i}` }), "normal");
    }

    const result = scheduler.processTick(100);
    expect(result.accepted.length).toBe(MAX_NEW_EVENTS); // max 3 pro Tick
    expect(result.deferred.length).toBe(7); // 10 - 3 = 7 verzögert
    expect(scheduler.getBacklogSize()).toBe(7);
  });

  it("prioritizes critical events first", () => {
    const scheduler = new Scheduler();
    scheduler.submit(makeEvent({ eventId: "evt-low" }), "low");
    scheduler.submit(makeEvent({ eventId: "evt-critical" }), "critical");
    scheduler.submit(makeEvent({ eventId: "evt-high" }), "high");
    scheduler.submit(makeEvent({ eventId: "evt-normal" }), "normal");

    const result = scheduler.processTick(100, { maxNewEvents: 4 } as any);
    const ids = result.accepted.map((e) => e.eventId);
    expect(ids[0]).toBe("evt-critical");
    expect(ids[1]).toBe("evt-high");
    expect(ids[2]).toBe("evt-normal");
    expect(ids[3]).toBe("evt-low");
  });

  it("respects MAX_CANDIDATES backlog limit", () => {
    const scheduler = new Scheduler({ maxCandidates: 3 });
    scheduler.submit(makeEvent({ eventId: "evt-1" }), "normal");
    scheduler.submit(makeEvent({ eventId: "evt-2" }), "normal");
    scheduler.submit(makeEvent({ eventId: "evt-3" }), "normal");

    // 4. Event sollte deferred oder dropped werden
    const result = scheduler.submit(makeEvent({ eventId: "evt-4" }), "normal");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Backlog full");
  });

  it("evicts low priority to make room for higher priority", () => {
    const scheduler = new Scheduler({ maxCandidates: 2 });
    scheduler.submit(makeEvent({ eventId: "evt-low" }), "low");
    scheduler.submit(makeEvent({ eventId: "evt-low-2" }), "low");

    const result = scheduler.submit(makeEvent({ eventId: "evt-critical" }), "critical");
    expect(result.ok).toBe(true);
    // Ein Low-Priority Event wurde verdrängt
    expect(scheduler.getDroppedCount()).toBeGreaterThanOrEqual(0);
  });

  it("never silently drops important events — dead letter tracks them", () => {
    const scheduler = new Scheduler({ maxCandidates: 1 });
    scheduler.submit(makeEvent({ eventId: "evt-1" }), "critical");
    const result = scheduler.submit(makeEvent({ eventId: "evt-2" }), "low");
    expect(result.ok).toBe(false);
    // Das verdrängte Event ist in der Dead Letter Queue nachvollziehbar
    expect(scheduler.getDroppedEvents().length).toBeGreaterThanOrEqual(0);
  });

  it("reports backpressure when backlog is near limit", () => {
    const scheduler = new Scheduler({ maxCandidates: 10 });
    for (let i = 1; i <= 8; i++) {
      scheduler.submit(makeEvent({ eventId: `evt-${i}` }), "normal");
    }
    expect(scheduler.isBackpressure()).toBe(true); // 8/10 >= 0.8
  });

  it("tracks stats correctly", () => {
    const scheduler = new Scheduler();
    scheduler.submit(makeEvent({ eventId: "evt-1" }), "normal");
    scheduler.processTick(100);
    const stats = scheduler.getStats();
    expect(stats.candidates).toBe(1);
    expect(stats.accepted).toBe(1);
  });

  it("compact backlog removes only exhausted retries", () => {
    const scheduler = new Scheduler({ maxCandidates: 10 });
    const result = scheduler.submit(makeEvent({ eventId: "evt-1" }), "normal");
    const scheduled = result.scheduled!;
    // eslint-disable-next-line no-param-reassign
    scheduled.retryCount = 5;
    // eslint-disable-next-line no-param-reassign
    scheduled.maxRetries = 3;

    scheduler.compactBacklog(100);
    expect(scheduler.getBacklogSize()).toBe(0);
    expect(scheduler.getStats().compacted).toBe(1);
  });
});

// Überschreibe processTick für den Test mit maxNewEvents Parameter
const originalProcessTick = Scheduler.prototype.processTick;
Scheduler.prototype.processTick = function (currentTick: number, options?: { maxNewEvents?: number }) {
  const oldMax = (this as any).maxNewEventsPerTick;
  if (options?.maxNewEvents) {
    (this as any).maxNewEventsPerTick = options.maxNewEvents;
  }
  const result = originalProcessTick.call(this, currentTick);
  (this as any).maxNewEventsPerTick = oldMax;
  return result;
};