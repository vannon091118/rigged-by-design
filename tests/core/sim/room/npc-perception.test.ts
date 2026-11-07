/**
 * NPC Perception Tests - Phase 7.4
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NPCPerceptionResolver,
  npcPerceptionResolver,
  type ActorContext,
  type PerceptionContext,
  type NeedType,
  type ActorTrait,
} from "../../../../src/core/sim/room/npc-perception";
import { RoomProfileCalculator } from "../../../../src/core/sim/room/room-profile";

describe("NPC Perception Resolver", () => {
  let resolver: NPCPerceptionResolver;

  beforeEach(() => {
    resolver = new NPCPerceptionResolver();
  });

  it("calculates interest for hunger need and food role", () => {
    const actorContext: ActorContext = {
      actorId: "npc-1",
      needs: new Map([["hunger", 0.8]]),
      traits: new Set(),
      persona: undefined,
      relationshipToRoom: new Map(),
    };

    const interest = resolver.calculateInterest(actorContext, "food", {
      actorId: "npc-1",
      roomId: "restaurant",
      need: "hunger",
      trait: undefined,
      worldTime: { tick: 100, day: 0, tickInDay: 0, ms: 0 },
    });

    expect(interest).toBeGreaterThan(0.5); // Base 0.5 + hunger bonus
    expect(interest).toBeLessThanOrEqual(1);
  });

  it("calculates interest for gambler trait and gambling role", () => {
    const actorContext: ActorContext = {
      actorId: "npc-1",
      needs: new Map(),
      traits: new Set(["gambler"]),
      persona: undefined,
      relationshipToRoom: new Map(),
    };

    const interest = resolver.calculateInterest(actorContext, "gambling", {
      actorId: "npc-1",
      roomId: "casino",
      need: undefined,
      trait: "gambler",
      worldTime: { tick: 100, day: 0, tickInDay: 0, ms: 0 },
    });

    expect(interest).toBeGreaterThan(0.5); // Base 0.5 + gambler trait bonus
  });

  it("calculates perceived profile", () => {
    const calculator = new RoomProfileCalculator();
    calculator.setRoomInstances("restaurant", [
      { objectId: "counter-1", furnitureId: "bar-counter", roomId: "restaurant", x: 0, y: 0, isDefective: false },
    ]);

    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("bar-counter", { roleWeightsBps: { drinks: 7000, social: 3000 } });

    const roomProfile = calculator.calculateProfile("restaurant", furnitureRegistry, 100);

    const actorContext: ActorContext = {
      actorId: "npc-1",
      needs: new Map([["hunger", 0.8]]),
      traits: new Set(["foodie"]),
      persona: undefined,
      relationshipToRoom: new Map(),
    };

    const perception = resolver.perceiveRoom(
      "npc-1",
      "restaurant",
      roomProfile,
      actorContext,
      { tick: 100, day: 0, tickInDay: 0, ms: 0 },
      "hunger",
      "foodie"
    );

    expect(perception.roomId).toBe("restaurant");
    expect(perception.actorId).toBe("npc-1");
    expect(perception.deterministic).toBe(true);
    expect(perception.perceivedProfile.size).toBeGreaterThan(0);
  });

  it("deterministic perception - same inputs same output", () => {
    const calculator = new RoomProfileCalculator();
    calculator.setRoomInstances("casino", [
      { objectId: "slot-1", furnitureId: "slot-machine", roomId: "casino", x: 0, y: 0, isDefective: false },
    ]);

    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("slot-machine", { roleWeightsBps: { gambling: 8000 } });

    const roomProfile = calculator.calculateProfile("casino", furnitureRegistry, 100);

    const actorContext: ActorContext = {
      actorId: "npc-1",
      needs: new Map(),
      traits: new Set(["gambler"]),
      persona: undefined,
      relationshipToRoom: new Map(),
    };

    const p1 = resolver.perceiveRoom("npc-1", "casino", roomProfile, actorContext, { tick: 100, day: 0, tickInDay: 0, ms: 0 });
    const p2 = resolver.perceiveRoom("npc-1", "casino", roomProfile, actorContext, { tick: 100, day: 0, tickInDay: 0, ms: 0 });

    expect(p1.perceivedProfile.get("gambling")).toBe(p2.perceivedProfile.get("gambling"));
  });

  it("perceives specific role", () => {
    const calculator = new RoomProfileCalculator();
    calculator.setRoomInstances("casino", [
      { objectId: "slot-1", furnitureId: "slot-machine", roomId: "casino", x: 0, y: 0, isDefective: false },
    ]);

    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("slot-machine", { roleWeightsBps: { gambling: 8000 } });

    const roomProfile = calculator.calculateProfile("casino", furnitureRegistry, 100);

    const actorContext: ActorContext = {
      actorId: "npc-1",
      needs: new Map(),
      traits: new Set(["gambler"]),
      persona: undefined,
      relationshipToRoom: new Map(),
    };

    const result = resolver.perceiveRole(
      "npc-1",
      "casino",
      roomProfile,
      actorContext,
      { tick: 100, day: 0, tickInDay: 0, ms: 0 },
      "gambling",
      undefined,
      "gambler"
    );

    expect(result.roomId).toBe("casino");
    expect(result.actorId).toBe("npc-1");
    expect(result.role).toBe("gambling");
    expect(result.perceivedWeight).toBeGreaterThan(0);
    expect(result.roomProfileWeight).toBe(8000);
  });

  it("invalidates perception cache", () => {
    const calculator = new RoomProfileCalculator();
    calculator.setRoomInstances("casino", [
      { objectId: "slot-1", furnitureId: "slot-machine", roomId: "casino", x: 0, y: 0, isDefective: false },
    ]);

    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("slot-machine", { roleWeightsBps: { gambling: 8000 } });

    const roomProfile = calculator.calculateProfile("casino", furnitureRegistry, 100);

    const actorContext: ActorContext = {
      actorId: "npc-1",
      needs: new Map(),
      traits: new Set(),
      persona: undefined,
      relationshipToRoom: new Map(),
    };

    resolver.perceiveRoom("npc-1", "casino", roomProfile, actorContext, { tick: 100, day: 0, tickInDay: 0, ms: 0 });
    expect(resolver.getStats().cachedPerceptions).toBeGreaterThan(0);

    resolver.invalidatePerception("casino");
    expect(resolver.getStats().cachedPerceptions).toBe(0);
  });
});
