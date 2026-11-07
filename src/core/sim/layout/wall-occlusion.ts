/**
 * Wall Occlusion - Phase 7.1
 * Sicht- und Okklusionsprüfung durch Wände.
 * WALL blockiert Sicht; DOOR und OPENING nicht.
 */

import type { LayoutGrid } from "./wall";
import { getTile, isValidTile } from "./wall";

export interface OcclusionResult {
  readonly occluded: boolean;
  readonly blockedBy: string | null;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
}

export function checkOcclusion(
  grid: LayoutGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): OcclusionResult {
  // Einfache Linien-Okklusion (Bresenham-ähnlich)
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  if (steps === 0) {
    return { occluded: false, blockedBy: null, sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY };
  }

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(fromX + (toX - fromX) * t);
    const y = Math.round(fromY + (toY - fromY) * t);

    if (!isValidTile(grid, x, y)) {
      return { occluded: true, blockedBy: "out-of-bounds", sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY };
    }

    const tile = getTile(grid, x, y);
    if (tile === "WALL") {
      return { occluded: true, blockedBy: "wall", sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY };
    }
  }

  return { occluded: false, blockedBy: null, sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY };
}

/**
 * Prüft ob eine Position von einer anderen aus sichtbar ist.
 */
export function isVisible(grid: LayoutGrid, fromX: number, fromY: number, toX: number, toY: number): boolean {
  return !checkOcclusion(grid, fromX, fromY, toX, toY).occluded;
}