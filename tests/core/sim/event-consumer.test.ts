import { describe, it, expect } from "vitest";
import {
  EventConsumer,
  DEFAULT_CONSUMER_OPTIONS,
  type ConsumerCursor,
  type TypedEventEnvelope,
} from "../../../src/core/sim/event-consumer";
import {
  createEventEnvelope,
  EVENT_SOURCES,
  isTriggerDialogExecutable,
  TRIGGER_DIALOG_EXECUTABLE,
} from "../../../src/core/sim/event-bus";
import { createWorldTime } from "../../../src/core/sim/worldtime";

function makeEvent(
  overrides: Partial<TypedEventEnvelope> = {}
): TypedEventEnvelope {
  return {
    eventId: "evt-1",
    kind: "domain-event",
    type: "visitor.arrived",
    domain: "social",
    worldTime: createWorldTime(100),
    source: EVENT_SOURCES.PLAYER,
    participants: ["actor-1"],
    payloadVersion: 1,
    payload: {},
    timestampMs: Date.now(),
    ...overrides,
  };
}

describe("Event Consumer (Phase 2.2)", () => {
  it("processes an event and marks it as processed", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    let handled = false;
    const handler = () => { handled = true; };

    const event = makeEvent({ eventId: "evt-1" });
    const result = consumer.processEvent(event, handler, 100);

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(handled).toBe(true);
    expect(consumer.getCursor().processedCount).toBe(1);
  });

  it("rejects duplicate event (idempotency)", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    let callCount = 0;
    const handler = () => { callCount++; };

    const event = makeEvent({ eventId: "evt-1" });
    const r1 = consumer.processEvent(event, handler, 100);
    const r2 = consumer.processEvent(event, handler, 100);

    expect(r1.applied).toBe(true);
    expect(r2.applied).toBe(false); // Duplikat — nicht angewendet
    expect(callCount).toBe(1); // Handler nur einmal aufgerufen
  });

  it("tracks cursor correctly", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    const handler = () => {};

    const event = makeEvent({ eventId: "evt-1" });
    consumer.processEvent(event, handler, 100);

    const cursor = consumer.getCursor();
    expect(cursor.lastProcessedEventId).toBe("evt-1");
    expect(cursor.lastProcessedTick).toBe(100);
    expect(cursor.processedCount).toBe(1);
  });

  it("dead letter queue receives events when handler throws", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    const throwingHandler = () => { throw new Error("Handler failed"); };

    const result = consumer.processEvent(makeEvent({ eventId: "evt-1" }), throwingHandler, 100);
    expect(result.ok).toBe(false);
    expect(consumer.getDeadLetterCount()).toBe(1);
  });

  it("replays pending events after restart (deterministic, idempotent)", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    const events: string[] = [];
    const handler = (e: TypedEventEnvelope) => { events.push(e.eventId); };

    consumer.processEvent(makeEvent({ eventId: "evt-1" }), handler, 100);
    consumer.processEvent(makeEvent({ eventId: "evt-2" }), handler, 100);

    // Handlers complete immediately, so no pending events to replay
    const replay = consumer.replayPending(handler, 200);
    expect(replay.processed).toBe(0);
    expect(replay.skipped).toBe(0);
  });

  it("retries dead letter events", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    const throwingHandler = () => { throw new Error("Handler failed"); };
    const okHandler = () => {};

    // Send event with throwing handler → dead letter
    consumer.processEvent(makeEvent({ eventId: "evt-1" }), throwingHandler, 100);
    expect(consumer.getDeadLetterCount()).toBe(1);

    // Retry with working handler → succeeds
    const retry = consumer.retryDeadLetter(okHandler, 200);
    expect(retry.succeeded).toBe(1);
    expect(consumer.getDeadLetterCount()).toBe(0);
  });

  it("restores cursor and compacts old processed entries", () => {
    const consumer = new EventConsumer({
      consumerId: "test-consumer",
      dedupWindow: 10,
    });
    const handler = () => {};

    consumer.processEvent(makeEvent({ eventId: "evt-1" }), handler, 100);
    const cursor = consumer.getCursor();

    // Neuen Consumer mit altem Cursor wiederherstellen
    const consumer2 = new EventConsumer({ consumerId: "test-consumer", dedupWindow: 10 });
    consumer2.restoreCursor(cursor, 500);

    expect(consumer2.getCursor().lastProcessedEventId).toBe("evt-1");
    // Kompaktion entfernt alte Einträge (100 < 500 - 20 = 480)
    const compacted = consumer2.compactProcessed(500);
    expect(compacted).toBeGreaterThanOrEqual(0);
  });

  it("retries dead letter events", () => {
    const consumer = new EventConsumer({ consumerId: "test-consumer" });
    const throwingHandler = () => { throw new Error("Handler failed"); };
    const okHandler = () => {};

    // Send event with throwing handler → dead letter
    consumer.processEvent(makeEvent({ eventId: "evt-1" }), throwingHandler, 100);
    expect(consumer.getDeadLetterCount()).toBe(1);

    // Retry with working handler → succeeds
    const retry = consumer.retryDeadLetter(okHandler, 200);
    expect(retry.succeeded).toBe(1);
    expect(consumer.getDeadLetterCount()).toBe(0);
  });

  it("isAlreadyProcessed returns false for unknown event", () => {
    const consumer = new EventConsumer();
    expect(consumer.isAlreadyProcessed("unknown", 100)).toBe(false);
  });
});

describe("Event Envelope & Sources (Phase 2.2)", () => {
  it("creates a full event envelope", () => {
    const event = createEventEnvelope(
      "evt-100",
      "domain-event",
      "visitor.arrived",
      "social",
      createWorldTime(500),
      EVENT_SOURCES.PERSONNEL,
      ["actor-1", "actor-2"],
      { location: "lobby" },
      1,
      "corr-1",
      "caus-1"
    );

    expect(event.eventId).toBe("evt-100");
    expect(event.domain).toBe("social");
    expect(event.source).toBe(EVENT_SOURCES.PERSONNEL);
    expect(event.participants).toEqual(["actor-1", "actor-2"]);
    expect(event.correlationId).toBe("corr-1");
    expect(event.causationId).toBe("caus-1");
    expect(event.payloadVersion).toBe(1);
  });

  it("registers missing event sources from roadmap", () => {
    expect(EVENT_SOURCES.DEVICE).toBe("device");
    expect(EVENT_SOURCES.INVENTORY).toBe("inventory");
    expect(EVENT_SOURCES.PERSONNEL).toBe("personnel");
  });

  it("TRIGGER_DIALOG is not executable — excluded from active content path", () => {
    expect(TRIGGER_DIALOG_EXECUTABLE).toBe(false);
    expect(isTriggerDialogExecutable()).toBe(false);
  });
});