/**
 * Layout Editor - Phase 7.1
 * Produktionsbaumaschine für Innenwände im Gameplay (nicht nur Editor).
 * Erreichbar im Produktionsbuild ohne VITE_RBD_EDITOR_MODE.
 */

import type { LayoutGrid, Wall, WallPlacement, WallType } from "./wall";
import { createWallDeterministic, setTile, isValidTile, WALL_TILE, DOOR_TILE, OPENING_TILE } from "./wall";
import { createNavGrid, computeRegions } from "./nav-grid";

let _layoutWallCounter = 0;

export interface LayoutEditorConfig {
  readonly maxWalls: number;
  readonly allowExteriorModification: boolean;
}

export const DEFAULT_LAYOUT_EDITOR_CONFIG: LayoutEditorConfig = {
  maxWalls: 1000,
  allowExteriorModification: false,
};

export class LayoutEditor {
  private grid: LayoutGrid;
  private walls: Map<string, Wall>;
  private revision: number;
  private readonly config: LayoutEditorConfig;

  constructor(grid: LayoutGrid, config: Partial<LayoutEditorConfig> = {}) {
    this.grid = grid;
    this.walls = new Map(grid.walls);
    this.revision = 0;
    this.config = { ...DEFAULT_LAYOUT_EDITOR_CONFIG, ...config };
  }

  /**
   * Setzt eine Innenwand im Layout. Im Produktionsbuild erreichbar.
   * WALL blockiert Kollision und Navigation.
   */
  placeWall(placement: WallPlacement, tick: number): { ok: boolean; wall?: Wall; error?: string } {
    if (this.walls.size >= this.config.maxWalls) {
      return { ok: false, error: "Maximum wall count reached" };
    }

    // Validate placement area
    for (let dy = 0; dy < placement.height; dy++) {
      for (let dx = 0; dx < placement.width; dx++) {
        const wx = placement.x + dx;
        const wy = placement.y + dy;
        if (!isValidTile(this.grid, wx, wy)) {
          return { ok: false, error: "Placement out of bounds" };
        }
      }
    }

    const wall = createWallDeterministic(
      placement.type,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
      tick,
      _layoutWallCounter++
    );

    // Apply wall tiles
    for (let dy = 0; dy < wall.height; dy++) {
      for (let dx = 0; dx < wall.width; dx++) {
        const wx = wall.x + dx;
        const wy = wall.y + dy;
        if (isValidTile(this.grid, wx, wy)) {
          const tileType =
            wall.type === "DOOR" ? DOOR_TILE : wall.type === "OPENING" ? OPENING_TILE : WALL_TILE;
          setTile(this.grid, wx, wy, tileType);
        }
      }
    }

    this.walls.set(wall.id, wall);
    this.revision++;

    return { ok: true, wall };
  }

  /**
   * Entfernt eine Wand und stellt die betroffenen Tiles auf EMPTY zurück.
   */
  removeWall(wallId: string): { ok: boolean; error?: string } {
    const wall = this.walls.get(wallId);
    if (!wall) {
      return { ok: false, error: "Wall not found" };
    }

    // Clear wall tiles
    for (let dy = 0; dy < wall.height; dy++) {
      for (let dx = 0; dx < wall.width; dx++) {
        const wx = wall.x + dx;
        const wy = wall.y + dy;
        if (isValidTile(this.grid, wx, wy)) {
          setTile(this.grid, wx, wy, "EMPTY");
        }
      }
    }

    this.walls.delete(wallId);
    this.revision++;

    return { ok: true };
  }

  getWall(wallId: string): Wall | undefined {
    return this.walls.get(wallId);
  }

  listWalls(): Wall[] {
    return Array.from(this.walls.values());
  }

  getGrid(): LayoutGrid {
    return this.grid;
  }

  getRevision(): number {
    return this.revision;
  }

  recomputeRegions() {
    return computeRegions(createNavGrid(this.grid));
  }
}

export function createLayoutEditor(grid: LayoutGrid, config?: Partial<LayoutEditorConfig>): LayoutEditor {
  return new LayoutEditor(grid, config);
}