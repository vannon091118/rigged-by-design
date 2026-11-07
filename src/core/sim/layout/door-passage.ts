/**
 * Door Passage - Phase 7.1
 * DOOR bleibt eine eigene, durchgehbare Raumverbindung/Schwelle zwischen
 * getrennten Raumregionen.
 */

import type { NavGrid } from "./nav-grid";
import type { LayoutGrid } from "./wall";
import { getTile, isValidTile } from "./wall";
import { getRoomAt, isDoorBoundary } from "./nav-grid";

export interface DoorPassageResult {
  readonly canPass: boolean;
  readonly blockedBy: string | null;
  readonly sourceRoom: string | null;
  readonly targetRoom: string | null;
  readonly isDoorBoundary: boolean;
}

export function checkDoorPassage(
  nav: NavGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): DoorPassageResult {
  const { grid } = nav;

  if (!isValidTile(grid, toX, toY)) {
    return {
      canPass: false,
      blockedBy: "out-of-bounds",
      sourceRoom: getRoomAt(nav, fromX, fromY),
      targetRoom: null,
      isDoorBoundary: false,
    };
  }

  const targetTile = getTile(grid, toX, toY);

  // WALL blockiert Türpassage
  if (targetTile === "WALL") {
    return {
      canPass: false,
      blockedBy: "wall",
      sourceRoom: getRoomAt(nav, fromX, fromY),
      targetRoom: null,
      isDoorBoundary: false,
    };
  }

  const sourceRoom = getRoomAt(nav, fromX, fromY);
  const targetRoom = getRoomAt(nav, toX, toY);
  const isBoundary = isDoorBoundary(nav, toX, toY);

  return {
    canPass: true,
    blockedBy: null,
    sourceRoom,
    targetRoom,
    isDoorBoundary: isBoundary,
  };
}

/**
 * Prüft ob eine Türposition eine Raumgrenze markiert.
 */
export function isDoorAtBoundary(nav: NavGrid, x: number, y: number): boolean {
  return isDoorBoundary(nav, x, y);
}

/**
 * Gibt alle Türpositionen zurück, die Raumgrenzen markieren.
 */
export function getDoorBoundaries(nav: NavGrid): Array<{ x: number; y: number }> {
  const boundaries: Array<{ x: number; y: number }> = [];
  const { grid } = nav;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (getTile(grid, x, y) === "DOOR" && isDoorBoundary(nav, x, y)) {
        boundaries.push({ x, y });
      }
    }
  }

  return boundaries;
}