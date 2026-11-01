/**
 * Simulationslogik für fremde Casinos (Foreign Floors).
 * Verarbeitet Job-Task-Fortschritt, Lohnauszahlung und Verletzungschecks
 * fuer den Spieler auf fremden Floors.
 */

import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { payDailyWage, completeJobTask } from './player-jobs';
import type { WorldState, ForeignFloorState, RivalId, Zone, Furniture, JobStationDef } from './types';

/** Ein Tick für einen einzelnen Foreign Floor. */
export function tickForeignFloor(
  world: WorldState,
  floor: ForeignFloorState,
  prng: Prng,
): void {
  // Synchronisiere Tag mit Welt
  floor.day = world.day;

  // Job-Task fortsetzen wenn Spieler auf diesem Floor arbeitet
  const job = world.player.job;
  if (job !== null && job.currentTask !== null) {
    job.currentTask.ticksElapsed += 1;
    if (job.currentTask.ticksElapsed >= job.currentTask.ticksTotal) {
      // Task abgeschlossen
      completeJobTask(world, prng);
    }
  }
}

/** Verarbeitet den Tageswechsel für alle Foreign Floors: Lohn auszahlung. */
export function processForeignFloorDaily(
  world: WorldState,
  ledger: Ledger,
  prng: Prng,
  _tick: number,
): void {
  for (const _floor of world.foreignFloors) {
    if (world.player.job !== null) {
      payDailyWage(world, ledger, prng, _tick);
    }
  }
}

/** Erstellt einen Foreign Floor State für einen Rivalen beim ersten Besuch. */
function createForeignFloor(
  world: WorldState,
  rivalId: RivalId,
  size: number,
  zones: readonly Zone[],
  furniture: Furniture[],
  jobStations: readonly JobStationDef[],
): ForeignFloorState {
  const id = world.nextForeignFloorId++;
  return {
    id,
    rivalId,
    size,
    zones,
    furniture,
    jobStations,
    playerPosition: null,
    playerPath: [],
    playerPathIndex: 0,
    playerCarrying: '',
    day: world.day,
    lastPaidDay: world.day,
  };
}

/** Speichert den Spieler-Zustand auf dem aktuellen Foreign Floor vor dem Verlassen. */
export function savePlayerToForeignFloor(
  world: WorldState,
  floorId: number,
): void {
  const floor = world.foreignFloors.find((f) => f.id === floorId);
  if (!floor) return;
  floor.playerPosition = { ...world.player.position };
  floor.playerPath = [...world.player.path];
  floor.playerPathIndex = world.player.pathIndex;
  floor.playerCarrying = world.player.carrying;
}

/** Stellt den Spieler-Zustand von einem Foreign Floor wieder her beim Betreten. */
export function loadPlayerFromForeignFloor(
  world: WorldState,
  floorId: number,
): void {
  const floor = world.foreignFloors.find((f) => f.id === floorId);
  if (!floor) return;
  if (floor.playerPosition) {
    world.player.position = { ...floor.playerPosition };
  }
  world.player.path = [...floor.playerPath];
  world.player.pathIndex = floor.playerPathIndex;
  world.player.carrying = floor.playerCarrying;
}

/** Gibt den Foreign Floor für eine rivalId zurück, erstellt ihn falls nötig. */
export function getOrCreateForeignFloor(
  world: WorldState,
  rivalId: RivalId,
  size: number,
  zones: readonly Zone[],
  furniture: Furniture[],
  jobStations: readonly JobStationDef[],
): ForeignFloorState {
  const existing = world.foreignFloors.find((f) => f.rivalId === rivalId);
  if (existing) return existing;
  const floor = createForeignFloor(world, rivalId, size, zones, furniture, jobStations);
  world.foreignFloors.push(floor);
  return floor;
}
