/**
 * Wall Collision Tests - Phase 7.1
 */

import { describe, it, expect } from "vitest";
import { createLayoutGrid } from "../../../../src/core/sim/layout/wall";
import { checkCollision, checkCollisionRect, canMoveTo } from "../../../../src/core/sim/layout/wall-collision";

describe("Wall Collision", () => {
  it("detects wall collision", () => {
    const grid = createLayoutGrid(10, 10);
    grid.tiles[5 * 10 + 5] = "WALL";
    
    const result = checkCollision(grid, 5, 5);
    expect(result.blocked).toBe(true);
    expect(result.blockedBy).toBe("wall");
  });

  it("allows empty tile", () => {
    const grid = createLayoutGrid(10, 10);
    const result = checkCollision(grid, 3, 3);
    expect(result.blocked).toBe(false);
  });

  it("blocks out of bounds", () => {
    const grid = createLayoutGrid(10, 10);
    const result = checkCollision(grid, -1, 5);
    expect(result.blocked).toBe(true);
  });

  it("canMoveTo returns correct boolean", () => {
    const grid = createLayoutGrid(10, 10);
    grid.tiles[5 * 10 + 5] = "WALL";
    
    expect(canMoveTo(grid, 5, 5)).toBe(false);
    expect(canMoveTo(grid, 3, 3)).toBe(true);
  });

  it("checks rectangle collision", () => {
    const grid = createLayoutGrid(10, 10);
    // Place a wall at (5,5) - rectangle (4,4)-(6,6) overlaps it
    grid.tiles[5 * 10 + 5] = "WALL";
    
    // Rectangle that overlaps wall at (5,5)
    const result = checkCollision(grid, 5, 5, 5, 5);
    expect(result).not.toBeNull();
    expect(result!.blocked).toBe(true);
    
    // Rectangle that doesn't overlap wall
    const result2 = checkCollisionRect(grid, 0, 0, 2, 2);
    expect(result2).toBeNull();
  });
});
