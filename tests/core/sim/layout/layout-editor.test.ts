/**
 * Layout Editor Tests - Phase 7.1
 * Produktionsbaumaschine für Innenwände.
 */

import { describe, it, expect } from "vitest";
import { createLayoutGrid } from "../../../../src/core/sim/layout/wall";
import { LayoutEditor, createLayoutEditor, DEFAULT_LAYOUT_EDITOR_CONFIG } from "../../../../src/core/sim/layout/layout-editor";
import { WallType } from "../../../../src/core/sim/layout/wall";
import { computeRegions } from "../../../../src/core/sim/layout/nav-grid";

describe("Layout Editor", () => {
  it("creates layout editor", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    expect(editor).toBeDefined();
    expect(editor.getRevision()).toBe(0);
  });

  it("places a wall", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    
    const result = editor.placeWall({
      type: "WALL",
      x: 3,
      y: 3,
      width: 2,
      height: 2,
    }, 100);
    
    expect(result.ok).toBe(true);
    expect(result.wall).toBeDefined();
    expect(result.wall?.type).toBe("WALL");
    expect(editor.getRevision()).toBe(1);
  });

  it("removes a wall", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    
    const placeResult = editor.placeWall({
      type: "WALL",
      x: 3,
      y: 3,
      width: 1,
      height: 1,
    }, 100);
    expect(placeResult.ok).toBe(true);
    
    const removeResult = editor.removeWall(placeResult.wall!.id);
    expect(removeResult.ok).toBe(true);
    expect(editor.getWall(placeResult.wall!.id)).toBeUndefined();
  });

  it("removes non-existent wall returns error", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    
    const result = editor.removeWall("non-existent-wall");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("respects max walls limit", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid, { maxWalls: 2 });
    
    editor.placeWall({ type: "WALL", x: 0, y: 0, width: 1, height: 1 }, 100);
    editor.placeWall({ type: "WALL", x: 1, y: 0, width: 1, height: 1 }, 100);
    
    const result = editor.placeWall({ type: "WALL", x: 2, y: 0, width: 1, height: 1 }, 100);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Maximum wall count");
  });

  it("places door and opening", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    
    const doorResult = editor.placeWall({
      type: "DOOR",
      x: 3,
      y: 3,
      width: 1,
      height: 1,
    }, 100);
    expect(doorResult.ok).toBe(true);
    
    const openingResult = editor.placeWall({
      type: "OPENING",
      x: 5,
      y: 3,
      width: 1,
      height: 1,
    }, 100);
    expect(openingResult.ok).toBe(true);
    
    const walls = editor.listWalls();
    expect(walls.length).toBe(2);
    expect(walls[0].type).toBe("DOOR");
    expect(walls[1].type).toBe("OPENING");
  });

  it("recomputes regions after wall placement", () => {
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    
    // Place vertical wall
    editor.placeWall({ type: "WALL", x: 5, y: 0, width: 1, height: 10 }, 100);
    
    const nav = editor.recomputeRegions();
    const leftRoom = getRoomAt(nav, 2, 5);
    const rightRoom = getRoomAt(nav, 8, 5);
    
    expect(leftRoom).toBeDefined();
    expect(rightRoom).toBeDefined();
    expect(leftRoom).not.toBe(rightRoom);
  });

  function getRoomAt(nav: ReturnType<typeof computeRegions>, x: number, y: number): string | null {
    const { grid } = nav;
    const idx = y * grid.width + x;
    return nav.tileToRoom.get(String(idx)) ?? null;
  }
});

describe("Layout Editor - Production Build", () => {
  it("is available in production build", () => {
    // Layout editor should be accessible in production build
    const grid = createLayoutGrid(10, 10);
    const editor = createLayoutEditor(grid);
    expect(editor).toBeDefined();
  });
});
