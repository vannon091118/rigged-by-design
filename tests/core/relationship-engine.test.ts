import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RelationshipEngine,
  relationshipEngine,
  createRelationshipCommand,
  type RelationshipCommand,
  type RelationshipDimension,
  scoreToDisposition,
} from "../../src/core/relationship-engine.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";
import { actorRegistry } from "../../src/core/actor-registry.js";

function makeCmd(overrides: Partial<RelationshipCommand> = {}): RelationshipCommand {
  return {
    commandId: "cmd-1",
    type: "adjust-trust",
    fromActorId: "actor-1",
    toActorId: "actor-2",
    dimension: "trust",
    delta: 50,
    worldTime: createWorldTime(100),
    reason: "test",
    ...overrides,
  };
}

describe("Relationship Engine (Phase 3.1)", () => {
  let engine: RelationshipEngine;

  beforeEach(() => {
    engine = new RelationshipEngine();
    // Registriere Test-Akteure
    actorRegistry.registerIdentity("actor-1", "visitor", "Besucher", 0);
    actorRegistry.registerIdentity("actor-2", "visitor", "Besucher 2", 0);
    actorRegistry.registerIdentity("actor-3", "staff", "Mitarbeiter", 0);
    actorRegistry.registerIdentity("actor-4", "rival", "Rivale", 0);
    actorRegistry.registerIdentity("actor-5", "player", "Spieler", 0);
  });

  afterEach(() => {
    // Clear engine edges
    // engine has no clear method, create new instance per test
  });

  it("applies a command and creates an edge", () => {
    const cmd = makeCmd();
    const result = engine.applyCommand(cmd);
    expect(result.ok).toBe(true);
    expect(result.edge?.score).toBe(50);
    expect(result.edge?.fromActorId).toBe("actor-1");
    expect(result.edge?.toActorId).toBe("actor-2");
    expect(result.edge?.dimension).toBe("trust");
  });

  it("maintains directed edges — no automatic symmetry", () => {
    const cmd1 = makeCmd({ fromActorId: "actor-1", toActorId: "actor-2", delta: 50 });
    const cmd2 = makeCmd({ fromActorId: "actor-2", toActorId: "actor-1", delta: -30 });

    engine.applyCommand(cmd1);
    engine.applyCommand(cmd2);

    const edge12 = engine.getEdge("actor-1", "actor-2", "trust");
    const edge21 = engine.getEdge("actor-2", "actor-1", "trust");

    expect(edge12?.score).toBe(50);
    expect(edge21?.score).toBe(-30);
    // Keine automatische Symmetrie: edge12 !== edge21
    expect(edge12?.score).not.toBe(edge21?.score);
  });

  it("clamps score to [-100, 100]", () => {
    const cmd = makeCmd({ delta: 200 });
    const result = engine.applyCommand(cmd);
    expect(result.ok).toBe(true);
    expect(result.edge?.score).toBe(100);

    const cmd2 = makeCmd({ delta: -200 });
    const result2 = engine.applyCommand(cmd2);
    expect(result2.ok).toBe(true);
    expect(result2.edge?.score).toBe(-100);
  });

  it("applies multiple commands atomically", () => {
    const cmds = [
      makeCmd({ delta: 30 }),
      makeCmd({ fromActorId: "actor-2", toActorId: "actor-1", dimension: "sympathy", delta: -20 }),
      makeCmd({ dimension: "conflict", delta: 10 }),
    ];
    const result = engine.applyCommands(cmds);
    expect(result.ok).toBe(true);
    expect(result.edges).toHaveLength(3);
  });

  it("rolls back on failure", () => {
    // Erst einen gültigen Befehl, dann einen ungültigen (set-disposition nicht unterstützt)
    const validCmd = makeCmd({ delta: 30 });
    const invalidCmd = makeCmd({ type: "set-disposition" as any, delta: 0 });

    const result = engine.applyCommands([validCmd, invalidCmd]);
    expect(result.ok).toBe(false);
    // Rollback: kein Edge wurde dauerhaft angewendet
    expect(engine.getEdge("actor-1", "actor-2", "trust")).toBeUndefined();
  });

  it("gets edges for actor (incoming and outgoing)", () => {
    engine.applyCommand(makeCmd({ fromActorId: "actor-1", toActorId: "actor-2", delta: 30 }));
    engine.applyCommand(makeCmd({ fromActorId: "actor-3", toActorId: "actor-1", delta: -20 }));

    const outgoing = engine.getOutgoingEdges("actor-1");
    const incoming = engine.getIncomingEdges("actor-1");

    expect(outgoing.length).toBe(1);
    expect(outgoing[0].toActorId).toBe("actor-2");
    expect(incoming.length).toBe(1);
    expect(incoming[0].fromActorId).toBe("actor-3");
  });

  it("builds relationship view for actor pair", () => {
    engine.applyCommand(makeCmd({ dimension: "trust", delta: 60 }));
    engine.applyCommand(makeCmd({ dimension: "sympathy", delta: 20 }));
    engine.applyCommand(makeCmd({ dimension: "conflict", delta: -10 }));
    engine.applyCommand(makeCmd({ dimension: "influence", delta: 10 }));

    const view = engine.getRelationshipView("actor-1", "actor-2");
    expect(view.trust).toBe(60);
    expect(view.sympathy).toBe(20);
    expect(view.conflict).toBe(-10);
    expect(view.influence).toBe(10);
    expect(view.overallDisposition).toBe("friendly"); // (60+20-(-10)+10)/4 = 25 -> friendly
  });

  it("returns neutral disposition when no edges exist", () => {
    const view = engine.getRelationshipView("actor-1", "actor-2");
    expect(view.overallDisposition).toBe("neutral");
    expect(view.trust).toBe(0);
    expect(view.sympathy).toBe(0);
  });

  it("counts edges without global cap", () => {
    // Erstelle viele Edges für viele verschiedene Paare
    for (let i = 0; i < 100; i++) {
      engine.applyCommand(
        makeCmd({ fromActorId: `actor-${i % 10}`, toActorId: `target-${i}`, delta: 10 })
      );
    }
    expect(engine.getEdgeCount()).toBe(100);
    // Kein globaler Cap — das soziale Netz kann wachsen
  });

  it("exports and imports edges for migration", () => {
    engine.applyCommand(makeCmd({ delta: 50 }));
    const exported = engine.exportEdges();
    expect(exported.length).toBe(1);

    const newEngine = new RelationshipEngine();
    newEngine.importEdges(exported);
    expect(newEngine.getEdgeCount()).toBe(1);
    expect(newEngine.getEdge("actor-1", "actor-2", "trust")?.score).toBe(50);
  });

  it("removes actor edges (archivierung)", () => {
    engine.applyCommand(makeCmd({ fromActorId: "actor-1", toActorId: "actor-2", delta: 30 }));
    engine.applyCommand(makeCmd({ fromActorId: "actor-2", toActorId: "actor-1", delta: -20 }));

    const removed = engine.removeActorEdges("actor-1");
    expect(removed).toBe(2);
    expect(engine.getEdge("actor-1", "actor-2", "trust")).toBeUndefined();
    expect(engine.getEdge("actor-2", "actor-1", "trust")).toBeUndefined();
  });

  it("scoreToDisposition maps correctly", () => {
    expect(scoreToDisposition(90)).toBe("intimate");
    expect(scoreToDisposition(50)).toBe("friendly");
    expect(scoreToDisposition(0)).toBe("neutral");
    expect(scoreToDisposition(-50)).toBe("hostile");
    expect(scoreToDisposition(-90)).toBe("hostile");
  });

  it("has no global edge cap", () => {
    // Der Engine hat keine maxEdges-Grenze
    expect(engine.getEdgeCount()).toBe(0);
    for (let i = 0; i < 500; i++) {
      engine.applyCommand(
        makeCmd({ fromActorId: `a-${i}`, toActorId: `b-${i}`, delta: 1 })
      );
    }
    expect(engine.getEdgeCount()).toBe(500);
  });
});

describe("Relationship Commands for different actor types", () => {
  let engine: RelationshipEngine;

  beforeEach(() => {
    engine = new RelationshipEngine();
  });

  it("visitor-visitor relationship", () => {
    const cmd = createRelationshipCommand(
      "adjust-trust",
      "visitor-1",
      "visitor-2",
      "trust",
      40,
      createWorldTime(50),
      "shared table"
    );
    const result = engine.applyCommand(cmd);
    expect(result.ok).toBe(true);
    expect(result.edge?.score).toBe(40);
  });

  it("staff-rival relationship", () => {
    const cmd = createRelationshipCommand(
      "adjust-conflict",
      "staff-1",
      "rival-1",
      "conflict",
      -60,
      createWorldTime(100),
      "competition"
    );
    const result = engine.applyCommand(cmd);
    expect(result.ok).toBe(true);
    expect(result.edge?.score).toBe(-60);
  });

  it("player-staff relationship", () => {
    const cmd = createRelationshipCommand(
      "adjust-trust",
      "player-1",
      "staff-1",
      "trust",
      80,
      createWorldTime(200),
      "regular customer"
    );
    const result = engine.applyCommand(cmd);
    expect(result.ok).toBe(true);
    expect(result.edge?.score).toBe(80);
  });

  it("different dimensions for same pair are independent", () => {
    const trustCmd = createRelationshipCommand(
      "adjust-trust",
      "a",
      "b",
      "trust",
      50,
      createWorldTime(1),
      "trust"
    );
    const conflictCmd = createRelationshipCommand(
      "adjust-trust",
      "a",
      "b",
      "conflict",
      -30,
      createWorldTime(2),
      "conflict"
    );

    engine.applyCommand(trustCmd);
    engine.applyCommand(conflictCmd);

    const view = engine.getRelationshipView("a", "b");
    expect(view.trust).toBe(50);
    expect(view.conflict).toBe(-30);
  });
});
