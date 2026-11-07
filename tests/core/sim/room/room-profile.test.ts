/**
 * Room Profile Tests - Phase 7.3
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RoomProfileCalculator,
  roomProfileCalculator,
  capacityFactor,
  conditionFactor,
  type RoomObjectInstance,
} from "../../../../src/core/sim/room/room-profile";

describe("Room Profile Calculator", () => {
  let calculator: RoomProfileCalculator;

  beforeEach(() => {
    calculator = new RoomProfileCalculator();
  });

  it("calculates capacity factor with diminishing returns", () => {
    expect(capacityFactor(0, { maxWeightBps: 10000, capacityDiminishingReturns: true, capacityExponent: 0.5 })).toBe(0);
    expect(capacityFactor(1, { maxWeightBps: 10000, capacityDiminishingReturns: true, capacityExponent: 0.5 })).toBe(1);
    expect(capacityFactor(4, { maxWeightBps: 10000, capacityDiminishingReturns: true, capacityExponent: 0.5 })).toBe(2);
    expect(capacityFactor(10, { maxWeightBps: 10000, capacityDiminishingReturns: true, capacityExponent: 0.5 })).toBeGreaterThan(1);
    expect(capacityFactor(10, { maxWeightBps: 10000, capacityDiminishingReturns: true, capacityExponent: 0.5 })).toBeLessThan(10);
  });

  it("calculates condition factor", () => {
    // Normal object
    expect(conditionFactor({ objectId: "o1", furnitureId: "f1", roomId: "r1", x: 0, y: 0, isDefective: false })).toBe(1);

    // Defective object carries 0
    expect(conditionFactor({ objectId: "o2", furnitureId: "f1", roomId: "r1", x: 0, y: 0, isDefective: true })).toBe(0);

    // Stock-dependent object with empty stock carries 0
    expect(conditionFactor({ objectId: "o3", furnitureId: "f1", roomId: "r1", x: 0, y: 0, isDefective: false, stock: 0, stockCapacity: 10 })).toBe(0);

    // Non-stock-dependent object doesn't lose function
    expect(conditionFactor({ objectId: "o4", furnitureId: "f1", roomId: "r1", x: 0, y: 0, isDefective: false, stock: undefined, stockCapacity: undefined })).toBe(1);
  });

  it("calculates room profile", () => {
    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("slot-machine", { roleWeightsBps: { gambling: 8000, social: 1000 } });
    furnitureRegistry.set("bar-counter", { roleWeightsBps: { drinks: 7000, social: 3000 } });

    calculator.setRoomInstances("room-1", [
      { objectId: "slot-1", furnitureId: "slot-machine", roomId: "room-1", x: 0, y: 0, isDefective: false },
      { objectId: "bar-1", furnitureId: "bar-counter", roomId: "room-1", x: 5, y: 5, isDefective: false },
    ]);

    const profile = calculator.calculateProfile("room-1", furnitureRegistry, 100);
    
    expect(profile.roomId).toBe("room-1");
    expect(profile.profile.get("gambling")).toBeGreaterThan(0);
    expect(profile.profile.get("drinks")).toBeGreaterThan(0);
    expect(profile.profile.get("social")).toBeGreaterThan(0);
    expect(profile.deterministic).toBeUndefined(); // RoomProfile doesn't have deterministic field
  });

  it("defective object carries 0 weight", () => {
    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("slot-machine", { roleWeightsBps: { gambling: 8000 } });

    calculator.setRoomInstances("room-1", [
      { objectId: "slot-1", furnitureId: "slot-machine", roomId: "room-1", x: 0, y: 0, isDefective: true },
    ]);

    const profile = calculator.calculateProfile("room-1", furnitureRegistry, 100);
    // Defective object contributes nothing, so no entry in profile
    expect(profile.profile.get("gambling")).toBeUndefined();
  });

  it("empty stock object carries 0 weight", () => {
    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("bar-counter", { roleWeightsBps: { drinks: 7000 } });

    calculator.setRoomInstances("room-1", [
      { objectId: "bar-1", furnitureId: "bar-counter", roomId: "room-1", x: 5, y: 5, isDefective: false, stock: 0, stockCapacity: 10 },
    ]);

    const profile = calculator.calculateProfile("room-1", furnitureRegistry, 100);
    expect(profile.profile.get("drinks")).toBeUndefined();
  });

  it("invalidates profile", () => {
    const furnitureRegistry = new Map<string, { roleWeightsBps: Record<string, number> }>();
    furnitureRegistry.set("slot-machine", { roleWeightsBps: { gambling: 8000 } });

    calculator.setRoomInstances("room-1", [
      { objectId: "slot-1", furnitureId: "slot-machine", roomId: "room-1", x: 0, y: 0, isDefective: false },
    ]);

    calculator.calculateProfile("room-1", furnitureRegistry, 100);
    expect(calculator.getProfile("room-1")).toBeDefined();

    calculator.invalidateProfile("room-1");
    // After invalidation, the profile should be stale
    const profile = calculator.getProfile("room-1");
    expect(profile?.isStale).toBe(true);
  });
});

describe("Global Room Profile Calculator", () => {
  it("is a singleton", () => {
    expect(roomProfileCalculator).toBeDefined();
  });
});
