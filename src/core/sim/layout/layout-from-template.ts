/**
 * Layout from Template - Phase 7.1
 * Loads layout templates with interior walls. Existing layouts remain loadable
 * without wall loss.
 */

import type { LayoutGrid, TileType, WallType, Wall } from "./wall";
import { createLayoutGrid, setTile, isValidTile, createWallDeterministic, WALL_TILE, DOOR_TILE, OPENING_TILE, FLOOR_TILE, EMPTY_TILE } from "./wall";
import { createNavGrid, computeRegions } from "./nav-grid";

export interface WallTemplate {
  readonly type: WallType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutTemplate {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly floorTiles: Array<{ x: number; y: number; type: TileType }>;
  readonly wallTemplates: WallTemplate[];
  readonly description?: string;
}

export interface LayoutLoadResult {
  readonly grid: LayoutGrid;
  readonly nav: ReturnType<typeof createNavGrid>;
  readonly walls: Wall[];
}

let _wallCounter = 0;

export function loadLayoutFromTemplate(template: LayoutTemplate, tick: number): LayoutLoadResult {
  const grid = createLayoutGrid(template.width, template.height);

  // Apply floor tiles first
  for (const floorTile of template.floorTiles) {
    if (isValidTile(grid, floorTile.x, floorTile.y)) {
      setTile(grid, floorTile.x, floorTile.y, floorTile.type);
    }
  }

  // Apply wall templates
  const walls: Wall[] = [];
  for (const wallTmpl of template.wallTemplates) {
    const wall = createWallDeterministic(
      wallTmpl.type,
      wallTmpl.x,
      wallTmpl.y,
      wallTmpl.width,
      wallTmpl.height,
      tick,
      _wallCounter++
    );

    // Fill the wall area with wall tiles
    for (let dy = 0; dy < wall.height; dy++) {
      for (let dx = 0; dx < wall.width; dx++) {
        const wx = wall.x + dx;
        const wy = wall.y + dy;
        if (isValidTile(grid, wx, wy)) {
          const tileType = wall.type === "DOOR" ? DOOR_TILE : wall.type === "OPENING" ? OPENING_TILE : WALL_TILE;
          setTile(grid, wx, wy, tileType);
        }
      }
    }

    walls.push(wall);
  }

  const nav = createNavGrid(grid);
  const computedNav = computeRegions(nav);

  return { grid, nav: computedNav, walls };
}

export function createDefaultLayout(tick: number): LayoutLoadResult {
  const template: LayoutTemplate = {
    id: "default-layout-1",
    name: "Default Layout with Interior Walls",
    width: 20,
    height: 15,
    floorTiles: [],
    wallTemplates: [
      // Exterior walls
      { type: "WALL", x: 0, y: 0, width: 20, height: 1 },
      { type: "WALL", x: 0, y: 14, width: 20, height: 1 },
      { type: "WALL", x: 0, y: 0, width: 1, height: 15 },
      { type: "WALL", x: 19, y: 0, width: 1, height: 15 },
      // Interior walls creating rooms
      { type: "WALL", x: 5, y: 2, width: 1, height: 6 },
      { type: "WALL", x: 10, y: 4, width: 1, height: 8 },
      { type: "DOOR", x: 5, y: 5, width: 1, height: 1 },
      { type: "OPENING", x: 10, y: 8, width: 1, height: 1 },
    ],
    description: "Default casino/social layout with interior walls dividing rooms",
  };

  return loadLayoutFromTemplate(template, tick);
}