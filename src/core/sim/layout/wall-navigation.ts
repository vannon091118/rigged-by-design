/**
 * Wall Navigation - Phase 7.1
 * WALL blockiert Navigation tatsächlich; DOOR bleibt passierbar.
 */

import type { NavGrid } from "./nav-grid";
import type { LayoutGrid } from "./wall";
import { isValidTile, getTile } from "./wall";
import { getRoomAt } from "./nav-grid";

export interface NavigationResult {
  readonly canNavigate: boolean;
  readonly blockedBy: string | null;
  readonly sourceRoom: string | null;
  readonly targetRoom: string | null;
  readonly crossesRoomBoundary: boolean;
}

export function checkNavigation(
  nav: NavGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): NavigationResult {
  const { grid } = nav;

  // Prüfe ob Ziel-Tile existiert und passabel ist
  if (!isValidTile(grid, toX, toY)) {
    return {
      canNavigate: false,
      blockedBy: "out-of-bounds",
      sourceRoom: getRoomAt(nav, fromX, fromY),
      targetRoom: null,
      crossesRoomBoundary: false,
    };
  }

  const targetTile = getTile(grid, toX, toY);

  // WALL blockiert Navigation
  if (targetTile === "WALL") {
    return {
      canNavigate: false,
      blockedBy: "wall",
      sourceRoom: getRoomAt(nav, fromX, fromY),
      targetRoom: null,
      crossesRoomBoundary: false,
    };
  }

  const sourceRoom = getRoomAt(nav, fromX, fromY);
  const targetRoom = getRoomAt(nav, toX, toY);
  const crossesRoomBoundary = sourceRoom !== null && targetRoom !== null && sourceRoom !== targetRoom;

  return {
    canNavigate: true,
    blockedBy: null,
    sourceRoom,
    targetRoom,
    crossesRoomBoundary,
  };
}

/**
 * Prüft ob eine Position begehbar ist (nicht WALL).
 */
export function isNavigable(nav: NavGrid, x: number, y: number): boolean {
  if (!isValidTile(nav.grid, x, y)) return false;
  const tile = getTile(nav.grid, x, y);
  return tile !== "WALL";
}

/**
 * Gibt alle durchgängigen Nachbarn einer Position zurück.
 */
export function getNavigableNeighbors(nav: NavGrid, x: number, y: number): Array<{ x: number; y: number }> {
  const neighbors: Array<{ x: number; y: number }> = [];
  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
  ];

  for (const dir of directions) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (isNavigable(nav, nx, ny)) {
      neighbors.push({ x: nx, y: ny });
    }
  }

  return neighbors;
}