/**
 * Wall types and constants for Phase 7.1 - Innenwände im Produktionsbuild.
 *
 * WALL: Begrenzt eine Raumregion (blockiert Navigation und Kollision)
 * DOOR: Eigene, durchgehbare Raumverbindung/Schwelle zwischen getrennten Raumregionen
 * OPENING: Nicht als Grenze behandelt, lässt Räume verschmelzen
 */

export type WallType = "WALL" | "DOOR" | "OPENING";

export type TileType = "EMPTY" | "WALL" | "DOOR" | "OPENING" | "FLOOR";

export interface Wall {
  readonly id: string;
  readonly type: WallType;
  readonly x: number;
  readonly y: number;
  readonly width: number;   // in Tiles
  readonly height: number;  // in Tiles
  readonly createdAtTick: number;
  readonly modifiedAtTick?: number;
}

export interface WallPlacement {
  readonly type: WallType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutGrid {
  readonly width: number;
  readonly height: number;
  readonly tiles: TileType[]; // index = y * width + x
  readonly walls: Map<string, Wall>;
}

export const EMPTY_TILE: TileType = "EMPTY";
export const WALL_TILE: TileType = "WALL";
export const DOOR_TILE: TileType = "DOOR";
export const OPENING_TILE: TileType = "OPENING";
export const FLOOR_TILE: TileType = "FLOOR";

export function createLayoutGrid(width: number, height: number): LayoutGrid {
  return {
    width,
    height,
    tiles: Array(width * height).fill(EMPTY_TILE),
    walls: new Map(),
  };
}

export function tileIndex(grid: LayoutGrid, x: number, y: number): number {
  return y * grid.width + x;
}

export function isValidTile(grid: LayoutGrid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

export function getTile(grid: LayoutGrid, x: number, y: number): TileType | null {
  if (!isValidTile(grid, x, y)) return null;
  return grid.tiles[tileIndex(grid, x, y)];
}

export function setTile(grid: LayoutGrid, x: number, y: number, type: TileType): void {
  if (!isValidTile(grid, x, y)) return;
  grid.tiles[tileIndex(grid, x, y)] = type;
}

export function createWall(
  type: WallType,
  x: number,
  y: number,
  width: number,
  height: number,
  tick: number
): Wall {
  return {
    id: `wall-${tick}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    x,
    y,
    width,
    height,
    createdAtTick: tick,
  };
}

// Deterministic wall ID without random
export function createWallDeterministic(
  type: WallType,
  x: number,
  y: number,
  width: number,
  height: number,
  tick: number,
  counter: number
): Wall {
  return {
    id: `wall-${tick}-${counter}`,
    type,
    x,
    y,
    width,
    height,
    createdAtTick: tick,
  };
}

export function isWallTile(type: TileType): boolean {
  return type === WALL_TILE;
}

export function isDoorTile(type: TileType): boolean {
  return type === DOOR_TILE;
}

export function isOpeningTile(type: TileType): boolean {
  return type === OPENING_TILE;
}

export function isPassableTile(type: TileType): boolean {
  return type !== WALL_TILE;
}

export function isBlockingTile(type: TileType): boolean {
  return type === WALL_TILE;
}