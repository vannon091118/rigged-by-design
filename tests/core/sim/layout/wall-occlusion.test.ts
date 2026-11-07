/**
 * Wall Occlusion Tests - Phase 7.1
 */

import { describe, it, expect } from "vitest";
import { createLayoutGrid } from "../../../../src/core/sim/layout/wall";
import { checkOcclusion, isVisible } from "../../../../src/core/sim/layout/wall-occlusion";

describe("Wall Occlusion", () => {
  it("blocks line of sight through wall", () => {
    const grid = createLayoutGrid(10, 10);
    for (let y = 0; y < 10; y++) {
      grid.tiles[y * 10 + 5] = "WALL";
    }
    
    const result = checkOcclusion(grid, 2, 5, 8, 5);
    expect(result.occluded).toBe(true);
    expect(result.blockedBy).toBe("wall");
  });

  it("allows line of sight through empty", () => {
    const grid = createLayoutGrid(10, 10);
    const result = checkOcclusion(grid, 2, 5, 8, 5);
    expect(result.occluded).toBe(false);
  });

  it("isVisible returns correct result", () => {
    const grid = createLayoutGrid(10, 10);
    grid.tiles[5 * 10 + 5] = "WALL";
    
    expect(isVisible(grid, 2, 5, 8, 5)).toBe(false);
    expect(isVisible(grid, 2, 5, 4, 5)).toBe(true);
  });

  it("same position is visible", () => {
    const grid = createLayoutGrid(10, 10);
    expect(isVisible(grid, 3, 3, 3, 3)).toBe(true);
  });
});
