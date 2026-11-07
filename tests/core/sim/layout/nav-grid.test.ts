/**
 * Nav Grid Tests - Phase 7.1
 */

import { describe, it, expect } from "vitest";
import { createLayoutGrid } from "../../../../src/core/sim/layout/wall";
import { createNavGrid, computeRegions, getRoomAt, areInSameRoom } from "../../../../src/core/sim/layout/nav-grid";

describe("Nav Grid", () => {
  it("creates empty nav grid", () => {
    const grid = createLayoutGrid(10, 10);
    const nav = createNavGrid(grid);
    expect(nav.grid).toBe(grid);
    expect(nav.regions.size).toBe(0);
    expect(nav.revision).toBe(0);
  });

  it("computes single region for empty grid", () => {
    const grid = createLayoutGrid(5, 5);
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    expect(computed.regions.size).toBe(1);
    const room = computed.regions.values().next().value;
    expect(room.tileCount).toBe(25);
  });

  it("gets room at position", () => {
    const grid = createLayoutGrid(5, 5);
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    const room = getRoomAt(computed, 2, 2);
    expect(room).toBeDefined();
  });

  it("checks if two tiles are in same room", () => {
    const grid = createLayoutGrid(5, 5);
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    expect(areInSameRoom(computed, 1, 1, 2, 2)).toBe(true);
  });

  it("gets all regions", () => {
    const grid = createLayoutGrid(10, 10);
    // Split with wall
    for (let y = 0; y < 10; y++) {
      grid.tiles[y * 10 + 5] = "WALL";
    }
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    const regions = computed.regions.values().next();
    expect(regions).toBeDefined();
    // Left region: 5 cols × 10 rows = 50 tiles
    expect(regions.value.tileCount).toBe(50);
  });
});
