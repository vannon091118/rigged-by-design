import { describe, it, expect, beforeEach } from "vitest";
import {
  NarrativeEngine,
  narrativeEngine,
  type Narrative,
  type NarrativePool,
  type NarrativeSelectionContext,
} from "../../src/core/narrative-engine.js";
import { createDomainEvent } from "../../src/core/domain-event.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";

function makeNarrative(overrides: Partial<Narrative> = {}): Narrative {
  return {
    id: "narrative-1",
    title: "Test Narrative",
    description: "A test narrative",
    domain: "social",
    version: "1.0.0",
    conditions: [],
    consequences: [],
    weight: 5000,
    cooldownTicks: 10,
    lastExecutedTick: undefined,
    executionCount: 0,
    tags: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<NarrativeSelectionContext> = {}): NarrativeSelectionContext {
  return {
    actorId: "actor-1",
    worldTime: createWorldTime(100),
    availableNarratives: [],
    ...overrides,
  };
}

describe("Narrative Engine (Phase 4)", () => {
  let engine: NarrativeEngine;

  beforeEach(() => {
    engine = new NarrativeEngine();
    engine.registerPool({
      domain: "social",
      narratives: new Map(),
      version: "1.0.0",
    });
  });

  it("registers a narrative pool", () => {
    const result = engine.registerPool({
      domain: "casino",
      narratives: new Map(),
      version: "1.0.0",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate pool registration", () => {
    engine.registerPool({ domain: "social", narratives: new Map(), version: "1.0.0" });
    const result = engine.registerPool({ domain: "social", narratives: new Map(), version: "1.0.0" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already registered");
  });

  it("adds a narrative to a pool", () => {
    const narrative = makeNarrative();
    const result = engine.addNarrative("social", narrative);
    expect(result.ok).toBe(true);
    expect(engine.getNarrative("social", "narrative-1")).toBeDefined();
  });

  it("selects a narrative deterministically", () => {
    const n1 = makeNarrative({ id: "n-1", weight: 1000 });
    const n2 = makeNarrative({ id: "n-2", weight: 9000 });
    engine.addNarrative("social", n1);
    engine.addNarrative("social", n2);

    const ctx = makeCtx({ worldTime: createWorldTime(500) });
    const selection = engine.selectNarrative(ctx);

    // Bei gleichem Kontext sollte dieselbe Auswahl getroffen werden
    const selection2 = engine.selectNarrative(ctx);
    expect(selection?.narrative.id).toBe(selection2?.narrative.id);
  });

  it("respects cooldown — narrative not selectable during cooldown", () => {
    const narrative = makeNarrative({ id: "n-cd", cooldownTicks: 100, lastExecutedTick: 450 });
    engine.addNarrative("social", narrative);

    const ctx = makeCtx({ worldTime: createWorldTime(500) }); // 50 Ticks seit letzter Ausführung < 100 Cooldown
    const selection = engine.selectNarrative(ctx);
    expect(selection).toBeNull();
  });

  it("respects max executions", () => {
    const narrative = makeNarrative({ id: "n-max", maxExecutions: 1, executionCount: 1 });
    engine.addNarrative("social", narrative);

    const ctx = makeCtx();
    const selection = engine.selectNarrative(ctx);
    expect(selection).toBeNull();
  });

  it("executes a narrative and produces events", () => {
    const narrative = makeNarrative({
      id: "n-exec",
      consequences: [
        {
          type: "event-emit",
          eventType: "visitor.arrived",
          eventPayload: { location: "lobby" },
          description: "Emit visitor arrived",
        },
      ],
    });
    engine.addNarrative("social", narrative);

    const ctx = makeCtx();
    const result = engine.executeNarrative("n-exec", "social", ctx);

    expect(result.ok).toBe(true);
    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe("visitor.arrived");
    expect(result.events[0].actorId).toBe("actor-1");
  });

  it("updates execution count after execution", () => {
    const narrative = makeNarrative({ id: "n-count" });
    engine.addNarrative("social", narrative);

    const ctx = makeCtx();
    engine.executeNarrative("n-count", "social", ctx);
    const after = engine.getNarrative("social", "n-count");
    expect(after?.executionCount).toBe(1);
  });

  it("lists narratives by domain", () => {
    engine.addNarrative("social", makeNarrative({ id: "n-a" }));
    engine.addNarrative("social", makeNarrative({ id: "n-b" }));

    const social = engine.listNarratives("social");
    expect(social.length).toBe(2);

    const casino = engine.listNarratives("casino");
    expect(casino.length).toBe(0);
  });

  it("has no domain-specific casino logic — domain-neutral", () => {
    // Die Engine funktioniert mit jeder beliebigen Domain
    engine.registerPool({ domain: "work", narratives: new Map(), version: "1.0.0" });
    engine.addNarrative("work", makeNarrative({ id: "n-work", domain: "work" }));
    const workNarratives = engine.listNarratives("work");
    expect(workNarratives.length).toBe(1);
    expect(workNarratives[0].domain).toBe("work");
  });
});

describe("Narrative Selection Determinism", () => {
  it("same actor + same tick → same narrative", () => {
    const engine = new NarrativeEngine();
    engine.registerPool({ domain: "test", narratives: new Map(), version: "1.0.0" });
    for (let i = 0; i < 10; i++) {
      engine.addNarrative("test", makeNarrative({ id: `n-${i}`, weight: 1000 }));
    }

    const ctx1 = makeCtx({ actorId: "actor-42", worldTime: createWorldTime(1000) });
    const ctx2 = makeCtx({ actorId: "actor-42", worldTime: createWorldTime(1000) });

    const s1 = engine.selectNarrative(ctx1);
    const s2 = engine.selectNarrative(ctx2);
    expect(s1?.narrative.id).toBe(s2?.narrative.id);
  });

  it("different actor → potentially different narrative", () => {
    const engine = new NarrativeEngine();
    engine.registerPool({ domain: "test", narratives: new Map(), version: "1.0.0" });
    for (let i = 0; i < 10; i++) {
      engine.addNarrative("test", makeNarrative({ id: `n-${i}`, weight: 1000 }));
    }

    const ctx1 = makeCtx({ actorId: "actor-1", worldTime: createWorldTime(1000) });
    const ctx2 = makeCtx({ actorId: "actor-2", worldTime: createWorldTime(1000) });

    const s1 = engine.selectNarrative(ctx1);
    const s2 = engine.selectNarrative(ctx2);
    // Können unterschiedlich sein (aber nicht müssen, da zufällig basierend auf Hash)
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
  });
});
