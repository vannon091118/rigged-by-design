/**
 * @module living-world-movement-evidence — Bewegung als Messgröße
 *
 * Das Messgerät liest nur, was `tickWorld` geschrieben hat: Kachel je Bewohner,
 * laufender Weg und Stundengrenze. Kein zweiter Simulator, keine Schätzung.
 */
import { ensureCityLife } from './city-life-state';
import { TICKS_PER_HOUR, tickInDay } from './clock';
import type { WorldState } from './types';

export type MovementEvidence = {
  readonly trips: number;
  readonly tilesWalked: number;
  readonly travelTicks: number;
  readonly maxTilesPerTick: number;
  readonly pendingAtHourBoundary: number;
};

export function createMovementTracker() {
  const lastPosition = new Map<string, { x: number; y: number }>();
  const inTravel = new Set<string>();
  const stats = { trips: 0, tilesWalked: 0, travelTicks: 0, maxTilesPerTick: 0, pendingAtHourBoundary: 0 };
  const sample = (world: WorldState): void => {
    for (const person of ensureCityLife(world).residents) {
      const before = lastPosition.get(person.npcId);
      if (before) {
        const step = Math.abs(person.position.x - before.x) + Math.abs(person.position.y - before.y);
        stats.maxTilesPerTick = Math.max(stats.maxTilesPerTick, step);
        stats.tilesWalked += step;
      }
      lastPosition.set(person.npcId, { ...person.position });
      if (!person.travel) {
        inTravel.delete(person.npcId);
        continue;
      }
      if (!inTravel.has(person.npcId)) stats.trips += 1;
      inTravel.add(person.npcId);
      stats.travelTicks += 1;
      if (tickInDay(world.tick) % TICKS_PER_HOUR === 0) stats.pendingAtHourBoundary += 1;
    }
  };
  return { sample, read: (): MovementEvidence => ({ ...stats }) };
}
