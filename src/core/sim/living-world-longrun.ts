/**
 * @module living-world-longrun — Harness für den langen Stadtlauf
 *
 * Der Test soll Behauptungen prüfen, nicht Buch führen. Dieser Harness tickt
 * die Welt, sammelt jede neue Entscheidung genau einmal und misst dabei die
 * Bewegung. Er liest nur den echten `tickWorld`-Pfad; kein zweiter Simulator.
 */
import { ensureCityLife } from './city-life-state';
import { createMovementTracker, type MovementEvidence } from './living-world-movement-evidence';
import { routineSample, type RoutineSample } from './living-world-longturn-snapshots';
import { TICKS_PER_DAY } from './demand';
import { tickWorld } from './tick';
import type { CityLifeDecision } from './city-life-types';
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import type { WorldState } from './types';

export interface LongRunResult {
  readonly routineSamples: readonly RoutineSample[];
  readonly allDecisions: readonly CityLifeDecision[];
  readonly scheduledDeviations: number;
  readonly nonSleepSeen: boolean;
  readonly movement: MovementEvidence;
}

/** Tickt bis `days` volle Tage erreicht sind und protokolliert Routinen. */
export function runLongRun(
  world: WorldState, ledger: Ledger, prng: Prng, days: number,
): LongRunResult {
  const tracker = createMovementTracker();
  const seen = new Set<number>();
  const allDecisions: CityLifeDecision[] = [];
  const routineSamples: RoutineSample[] = [];
  let scheduledDeviations = 0;
  let nonSleepSeen = false;
  while (world.tick < TICKS_PER_DAY * days) {
    tickWorld(world, ledger, prng);
    tracker.sample(world);
    if (ensureCityLife(world).residents.some((person) => person.intent !== 'SLEEP')) nonSleepSeen = true;
    for (const decision of world.cityLife.lastDecisions ?? []) {
      if (seen.has(decision.id)) continue;
      seen.add(decision.id);
      allDecisions.push(decision);
      routineSamples.push(routineSample(decision));
      if (decision.scheduledIntent !== decision.intent) scheduledDeviations += 1;
    }
  }
  return {
    routineSamples, allDecisions, scheduledDeviations, nonSleepSeen,
    movement: tracker.read(),
  };
}
