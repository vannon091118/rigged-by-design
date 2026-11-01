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

  // Nur der Floor, auf dem der Spieler steht und für den er arbeitet, treibt die Aufgabe.
  if (world.activeForeignFloorId !== floor.id) return;
  const job = world.player.job;
  if (job === null || job.rivalId !== floor.rivalId || job.currentTask === null) return;
  job.currentTask.ticksElapsed += 1;
  if (job.currentTask.ticksElapsed >= job.currentTask.ticksTotal) {
    completeJobTask(world, prng);
  }
}

/** Verarbeitet den Tageswechsel für alle Foreign Floors: Lohn auszahlung. */
export function processForeignFloorDaily(
  world: WorldState,
  ledger: Ledger,
  prng: Prng,
  tick: number,
): void {
  payDailyWage(world, ledger, prng, tick);
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
