/**
 * Room Cache Tests - Phase 7.3
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoomCache, roomCache } from "../../../../src/core/sim/room/room-cache";
import { RoomProfileCalculator } from "../../../../src/core/sim/room/room-profile";

describe("Room Cache", () => {
  let cache: RoomCache;

  beforeEach(() => {
    cache = new RoomCache();
  });

  it("creates empty cache", () => {
    const stats = cache.getStats();
    expect(stats.cachedProfiles).toBe(0);
    expect(stats.cachedRoles).toBe(0);
    expect(stats.isValid).toBe(false);
  });

  it("stores and retrieves cache entry", () => {
    const key = cache.getCurrentKey();
    const profiles = new Map<string, any>();
    const roleIndex = new Map<string, string[]>();
    
    cache.set(key, profiles, roleIndex, 100);
    
    const retrieved = cache.get(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.calculatedAtTick).toBe(100);
  });

  it("returns null for invalid key", () => {
    const key1 = cache.getCurrentKey();
    cache.incrementLayoutRevision();
    const key2 = cache.getCurrentKey();
    
    cache.set(key1, new Map(), new Map(), 100);
    expect(cache.get(key2)).toBeNull();
  });

  it("invalidates rooms", () => {
    const key = cache.getCurrentKey();
    const profiles = new Map<string, any>([["room-1", { roomId: "room-1" }], ["room-2", { roomId: "room-2" }]]);
    const roleIndex = new Map<string, string[]>([["gambling", ["room-1", "room-2"]]]);
    
    cache.set(key, profiles, roleIndex, 100);
    expect(cache.get(key)!.profiles.size).toBe(2);
    
    cache.invalidateRooms(["room-1"]);
    const retrieved = cache.get(key);
    expect(retrieved!.profiles.size).toBe(1);
    expect(retrieved!.profiles.has("room-2")).toBe(true);
  });

  it("gets rooms by role", () => {
    const key = cache.getCurrentKey();
    const profiles = new Map<string, any>();
    const roleIndex = new Map<string, string[]>([["gambling", ["room-1", "room-2", "room-3"]]]);
    
    cache.set(key, profiles, roleIndex, 100);
    
    const rooms = cache.getRoomsByRole("gambling");
    expect(rooms).toEqual(["room-1", "room-2", "room-3"]);
  });

  it("gets top rooms by role", () => {
    const key = cache.getCurrentKey();
    const profiles = new Map<string, any>([
      ["room-1", { profile: new Map([["gambling", 8000]]) }],
      ["room-2", { profile: new Map([["gambling", 5000]]) }],
      ["room-3", { profile: new Map([["gambling", 3000]]) }],
    ]);
    const roleIndex = new Map<string, string[]>([["gambling", ["room-1", "room-2", "room-3"]]]);
    
    cache.set(key, profiles, roleIndex, 100);
    
    const top = cache.getTopRoomsByRole("gambling", profiles, 2);
    expect(top.length).toBe(2);
    expect(top[0].roomId).toBe("room-1");
    expect(top[0].weightBps).toBe(8000);
    expect(top[1].roomId).toBe("room-2");
    expect(top[1].weightBps).toBe(5000);
  });

  it("increments revision counters", () => {
    const key1 = cache.getCurrentKey();
    cache.incrementLayoutRevision();
    const key2 = cache.getCurrentKey();
    expect(key1.layoutRevision).not.toBe(key2.layoutRevision);
    
    cache.incrementObjectRevision();
    cache.incrementInstanceRevision();
    cache.incrementRepairStateRevision();
    cache.incrementCapacityRevision();
    const key3 = cache.getCurrentKey();
    expect(key3.objectRevision).toBe(1);
    expect(key3.instanceRevision).toBe(1);
    expect(key3.repairStateRevision).toBe(1);
    expect(key3.capacityRevision).toBe(1);
  });
});

describe("Global Room Cache", () => {
  it("is a singleton", () => {
    expect(roomCache).toBeDefined();
  });
});
