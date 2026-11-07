/**
 * Layout From Template Tests - Phase 7.1
 */

import { describe, it, expect } from "vitest";
import {
  loadLayoutFromTemplate,
  createDefaultLayout,
} from "../../../../src/core/sim/layout/layout-from-template";

describe("Layout From Template", () => {
  it("loads default layout", () => {
    const result = createDefaultLayout(100);
    expect(result.grid).toBeDefined();
    expect(result.nav).toBeDefined();
    expect(result.walls.length).toBeGreaterThan(0);
  });

  it("loads template with interior walls", () => {
    const template = {
      id: "test-layout",
      name: "Test Layout",
      width: 10,
      height: 10,
      floorTiles: [],
      wallTemplates: [
        { type: "WALL", x: 3, y: 3, width: 1, height: 4 },
        { type: "DOOR", x: 3, y: 5, width: 1, height: 1 },
      ],
    };
    
    const result = loadLayoutFromTemplate(template, 100);
    expect(result.grid.width).toBe(10);
    expect(result.grid.height).toBe(10);
    expect(result.walls.length).toBe(2);
    
    // Check wall tiles were placed
    expect(result.grid.tiles[3 * 10 + 3]).toBe("WALL");
    expect(result.grid.tiles[5 * 10 + 3]).toBe("DOOR");
  });

  it("has regions after template load", () => {
    const result = createDefaultLayout(100);
    const regions = result.nav.regions;
    expect(regions.size).toBeGreaterThan(0);
  });
});
