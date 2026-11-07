/**
 * Wall Collision - Phase 7.1
 * WALL blockiert Kollision und Navigation tatsächlich.
 */

import type { LayoutGrid } from "./wall";
import { isBlockingTile, isValidTile } from "./wall";

export interface CollisionResult {
  readonly blocked: boolean;
  readonly blockedBy: string | null;
  readonly x: number;
  readonly y: number;
}

export function checkCollision(grid: LayoutGrid, x: number, y: number): CollisionResult {
  if (!isValidTile(grid, x, y)) {
    return { blocked: true, blockedBy: "out-of-bounds", x, y };
  }

  const tile = grid.tiles[y * grid.width + x];

  if (isBlockingTile(tile)) {
    return { blocked: true, blockedBy: "wall", x, y };
  }

  return { blocked: false, blockedBy: null, x, y };
}

export function checkCollisionRect(
  grid: LayoutGrid,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): CollisionResult | null {
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const result = checkCollision(grid, x, y);
      if (result.blocked) {
        return result;
      }
    }
  }
  return null;
}

export function canMoveTo(grid: LayoutGrid, x: number, y: number): boolean {
  return !checkCollision(grid, x, y).blocked;
}