/**
 * Room ID Stabilization - Phase 7.1
 *
 * Bei Umbau bleiben RoomIds deterministisch und nachvollziehbar:
 * - Bei Split behält die Region mit maximaler Tile-Überlappung die bisherige ID
 * - Bei Merge wird eine definierte Vorgänger-ID gewählt (kleinste numerische ID)
 * - Andere IDs werden als Alias/History nachvollziehbar
 * - Keine zufälligen IDs
 */

import type { RoomRegion, NavGrid } from "./nav-grid";
import type { LayoutGrid } from "./wall";

export interface RoomIdChange {
  readonly oldRoomId: string;
  readonly newRoomId: string;
  readonly reason: "split" | "merge";
  readonly tileOverlap: number;
}

export interface StabilizationResult {
  readonly roomIdChanges: RoomIdChange[];
  readonly aliasMap: Map<string, string>; // oldId -> newId (for history)
  readonly removedRoomIds: string[];
}

/**
 * Stabilisiert RoomIds nach einem Umbau.
 * Vergleicht alte und neue Regionen und bestimmt, welche IDs beibehalten werden.
 */
export function stabilizeRoomIds(
  oldRegions: Map<string, RoomRegion>,
  newRegions: Map<string, RoomRegion>,
  oldTileToRoom: Map<string, string>,
  newTileToRoom: Map<string, string>
): StabilizationResult {
  const roomIdChanges: RoomIdChange[] = [];
  const aliasMap = new Map<string, string>();
  const removedRoomIds: string[] = [];

  // Für jede neue Region finde die beste alte Übereinstimmung
  const assignedOldIds = new Set<string>();

  for (const [newRoomId, newRegion] of newRegions) {
    let bestOldRoomId: string | null = null;
    let bestOverlap = 0;

    for (const tileIdx of newRegion.tiles) {
      const oldRoomId = oldTileToRoom.get(String(tileIdx));
      if (oldRoomId && !assignedOldIds.has(oldRoomId)) {
        // Zähle Überlappung
        const oldRegion = oldRegions.get(oldRoomId);
        if (oldRegion) {
          const overlap = countTileOverlap(oldRegion.tiles, newRegion.tiles);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestOldRoomId = oldRoomId;
          }
        }
      }
    }

    if (bestOldRoomId && bestOverlap > 0) {
      // Split oder kontinuierliche Region: behalte alte ID
      assignedOldIds.add(bestOldRoomId);
      if (bestOldRoomId !== newRoomId) {
        roomIdChanges.push({
          oldRoomId: bestOldRoomId,
          newRoomId: bestOldRoomId,
          reason: "split",
          tileOverlap: bestOverlap,
        });
        aliasMap.set(newRoomId, bestOldRoomId);
      }
    } else {
      // Neue Region ohne Überlappung: neue ID
      // Bei Merge: wähle kleinste numerische Vorgänger-ID
      const mergedOldIds = getMergedOldIds(newRegion, oldTileToRoom, oldRegions);
      if (mergedOldIds.length > 1) {
        const sortedIds = mergedOldIds.sort();
        const chosenId = sortedIds[0];
        roomIdChanges.push({
          oldRoomId: chosenId,
          newRoomId: chosenId,
          reason: "merge",
          tileOverlap: 0,
        });
        // Andere IDs werden Alias
        for (const oldId of mergedOldIds) {
          if (oldId !== chosenId) {
            aliasMap.set(oldId, chosenId);
          }
        }
        removedRoomIds.push(...mergedOldIds.filter((id) => id !== chosenId));
      }
    }
  }

  // Alte Regionen, die nicht zugewiesen wurden, sind entfernt
  for (const [oldRoomId] of oldRegions) {
    if (!assignedOldIds.has(oldRoomId)) {
      removedRoomIds.push(oldRoomId);
    }
  }

  return { roomIdChanges, aliasMap, removedRoomIds };
}

function countTileOverlap(setA: Set<number>, setB: Set<number>): number {
  let overlap = 0;
  for (const tile of setA) {
    if (setB.has(tile)) overlap++;
  }
  return overlap;
}

function getMergedOldIds(
  newRegion: RoomRegion,
  oldTileToRoom: Map<string, string>,
  oldRegions: Map<string, RoomRegion>
): string[] {
  const oldIds = new Set<string>();
  for (const tileIdx of newRegion.tiles) {
    const oldRoomId = oldTileToRoom.get(String(tileIdx));
    if (oldRoomId) oldIds.add(oldRoomId);
  }
  return Array.from(oldIds);
}

/**
 * Generiert eine deterministische RoomId aus Koordinaten und Tick.
 * Keine Zufalls-IDs.
 */
export function generateDeterministicRoomId(
  prefix: string,
  x: number,
  y: number,
  tick: number
): string {
  return `${prefix}-${x}-${y}-${tick}`;
}