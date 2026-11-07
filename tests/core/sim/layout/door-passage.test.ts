/**
 * Door Passage Tests - Phase 7.1
 */

import { describe, it, expect } from "vitest";
import { createLayoutGrid } from "../../../../src/core/sim/layout/wall";
import { createNavGrid, computeRegions } from "../../../../src/core/sim/layout/nav-grid";
import { checkDoorPassage, getDoorBoundaries } from "../../../../src/core/sim/layout/door-passage";

describe("Door Passage", () => {
  it("checks door passage", () => {
    const grid = createLayoutGrid(10, 10);
    for (let y = 0; y < 10; y++) {
      if (y === 5) {
        grid.tiles[y * 10 + 5] = "DOOR";
      } else {
        grid.tiles[y * 10 + 5] = "WALL";
      }
    }
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    const result = checkDoorPassage(computed, 4, 5, 5, 5);
    expect(result.canPass).toBe(true);
    expect(result.isDoorBoundary).toBe(true);
  });

  it("blocks door passage through wall", () => {
    const grid = createLayoutGrid(10, 10);
    grid.tiles[5 * 10 + 5] = "WALL";
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    const result = checkDoorPassage(computed, 4, 5, 5, 5);
    expect(result.canPass).toBe(false);
  });

  it("gets door boundaries", () => {
    const grid = createLayoutGrid(10, 10);
    for (let y = 0; y < 10; y++) {
      if (y === 5) {
        grid.tiles[y * 10 + 5] = "DOOR";
      } else {
        grid.tiles[y * 10 + 5] = "WALL";
      }
    }
    const nav = createNavGrid(grid);
    const computed = computeRegions(nav);
    
    const boundaries = getDoorBoundaries(computed);
    expect(boundaries.length).toBeGreaterThan(0);
  });
});
