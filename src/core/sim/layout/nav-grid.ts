/**
 * Navigation Grid - Phase 7.1
 *
 * Deterministic flood-fill region detection:
 * - WALL begrenzt eine Region (blockiert Navigation und Kollision)
 * - DOOR bleibt eine eigene, durchgehbare Raumverbindung/Schwelle zwischen getrennten Raumregionen
 * - OPENING wird nicht als Grenze behandelt und lässt Räume verschmelzen
 */

import type { LayoutGrid, TileType } from "./wall";
import { WALL_TILE, DOOR_TILE, OPENING_TILE, EMPTY_TILE, FLOOR_TILE, isValidTile } from "./wall";
import { WALL_TILE, DOOR_TILE, OPENING_TILE, EMPTY_TILE, FLOOR_TILE, isValidTile } from "./wall";

export interface RoomRegion {
  readonly roomId: string;
  readonly tiles: Set<number>; // tile indices
  readonly boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  readonly tileCount: number;
}

export interface NavGrid {
  readonly grid: LayoutGrid;
  readonly regions: Map<string, RoomRegion>;
  readonly tileToRoom: Map<string, string>; // tile index -> roomId
  readonly revision: number; // increments on structural change
}

export function createNavGrid(grid: LayoutGrid): NavGrid {
  return {
    grid,
    regions: new Map(),
    tileToRoom: new Map(),
    revision: 0,
  };
}

/**
 * Deterministic flood-fill: assigns room IDs to contiguous passable areas.
 * WALL tiles block flood fill. DOOR tiles are passable but mark region boundaries.
 * OPENING tiles are passable and do NOT mark boundaries (rooms merge through them).
 */
export function computeRegions(nav: NavGrid): NavGrid {
  const { grid } = nav;
  const visited = new Set<number>();
  const regions = new Map<string, RoomRegion>();
  const tileToRoom = new Map<string, string>();
  let regionCounter = 0;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const idx = y * grid.width + x;
      if (visited.has(idx)) continue;

      const tile = grid.tiles[idx];

      // WALL tiles are not part of any region
      if (tile === WALL_TILE) {
        visited.add(idx);
        continue;
      }

      // Start flood fill from this tile
      const regionTiles = new Set<number>();
      const queue: number[] = [idx];
      visited.add(idx);

      let minX = x, minY = y, maxX = x, maxY = y;

      while (queue.length > 0) {
        const cur = queue.pop()!;
        const curY = Math.floor(cur / grid.width);
        const curX = cur % grid.width;

        regionTiles.add(cur);
        minX = Math.min(minX, curX);
        minY = Math.min(minY, curY);
        maxX = Math.max(maxX, curX);
        maxY = Math.max(maxY, curY);

        // Check 4 neighbors
        const neighbors = [
          { x: curX - 1, y: curY },
          { x: curX + 1, y: curY },
          { x: curX, y: curY - 1 },
          { x: curX, y: curY + 1 },
        ];

        for (const nb of neighbors) {
          if (!isValidTile(grid, nb.x, nb.y)) continue;
          const nbIdx = nb.y * grid.width + nb.x;
          if (visited.has(nbIdx)) continue;

          const nbTile = grid.tiles[nbIdx];

          // WALL blocks flood fill
          if (nbTile === WALL_TILE) {
            visited.add(nbIdx);
            continue;
          }

          // DOOR is passable but marks a region boundary - don't cross it
          // OPENING is passable and does NOT mark boundary (rooms merge)
          if (nbTile === DOOR_TILE) {
            visited.add(nbIdx);
            continue;
          }

          visited.add(nbIdx);
          queue.push(nbIdx);
        }
      }

      if (regionTiles.size > 0) {
        const roomId = `room-${regionCounter++}`;
        const region: RoomRegion = {
          roomId,
          tiles: regionTiles,
          boundingBox: { minX, minY, maxX, maxY },
          tileCount: regionTiles.size,
        };
        regions.set(roomId, region);
        for (const tileIdx of regionTiles) {
          tileToRoom.set(String(tileIdx), roomId);
        }
      }
    }
  }

  return {
    ...nav,
    regions,
    tileToRoom,
    revision: nav.revision + 1,
  };
}

function isValidTile(grid: LayoutGrid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

/**
 * Get the room ID for a tile. Returns null for WALL tiles.
 */
export function getRoomAt(nav: NavGrid, x: number, y: number): string | null {
  if (!isValidTileNav(nav.grid, x, y)) return null;
  const idx = y * nav.grid.width + x;
  const tile = nav.grid.tiles[idx];

  if (tile === WALL_TILE) return null;
  return nav.tileToRoom.get(String(idx)) ?? null;
}

/**
 * Check if two tiles are in the same room region.
 */
export function areInSameRoom(nav: NavGrid, x1: number, y1: number, x2: number, y2: number): boolean {
  const r1 = getRoomAt(nav, x1, y1);
  const r2 = getRoomAt(nav, x2, y2);
  return r1 !== null && r1 === r2;
}

/**
 * Check if a tile is passable (not WALL).
 */
export function isTilePassable(grid: LayoutGrid, x: number, y: number): boolean {
  if (!isValidTileNav(grid, x, y)) return false;
  const tile = grid.tiles[y * grid.width + x];
  return tile !== WALL_TILE;
}

function isValidTileNav(grid: LayoutGrid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

/**
 * Get all regions in the nav grid.
 */
export function getAllRegions(nav: NavGrid): RoomRegion[] {
  return Array.from(nav.regions.values());
}

/**
 * Get region by ID.
 */
export function getRegion(nav: NavGrid, roomId: string): RoomRegion | undefined {
  return nav.regions.get(roomId);
}

/**
 * Check if a door connects two different regions.
 */
export function isDoorBoundary(nav: NavGrid, x: number, y: number): boolean {
  if (!isValidTileNav(nav.grid, x, y)) return false;
  const tile = nav.grid.tiles[y * nav.grid.width + x];
  if (tile !== DOOR_TILE) return false;

  // Check if neighbors on opposite sides are in different rooms
  const neighbors = [
    { x: x - 1, y: y },
    { x: x + 1, y: y },
    { x: x, y: y - 1 },
    { x: x, y: y + 1 },
  ];

  const rooms = new Set<string>();
  for (const nb of neighbors) {
    const room = getRoomAt(nav, nb.x, nb.y);
    if (room) rooms.add(room);
  }

  return rooms.size >= 2;
}