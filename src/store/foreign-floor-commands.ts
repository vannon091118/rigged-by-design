/** Foreign Floor Commands: Besucher- und Job-Aktionen in fremden Casinos. */

import { acceptJob, quitJob, requestJobTask, buyBar } from '../core/sim/player-jobs';
import { getOrCreateForeignFloor } from '../core/sim/foreign-floor-tick';
import { getRival, type RivalId } from '../core/sim/rivals';
import type { WorldState } from '../core/sim/types';
import type { Ledger } from '../core/economy/ledger';

export function acceptJobCmd(world: WorldState, rivalId: RivalId, jobId: import('../core/sim/types').PlayerJobId): void {
  acceptJob(world, rivalId, jobId);
}

export function quitJobCmd(world: WorldState): void {
  quitJob(world);
}

export function requestJobTaskCmd(world: WorldState): { started: boolean; queuePosition: number } {
  return requestJobTask(world);
}

export function buyBarCmd(world: WorldState, ledger: Ledger, tick: number): void {
  buyBar(world, ledger, tick);
}

export function visitForeignCmd(world: WorldState, rivalId: RivalId): void {
  const rival = getRival(rivalId);
  const floor = getOrCreateForeignFloor(
    world,
    rivalId,
    rival.size,
    [],
    [],
    rival.jobStations,
  );
  world.activeForeignFloorId = floor.id;
}

export function leaveForeignCmd(world: WorldState): void {
  if (world.activeForeignFloorId === null) throw new Error('Du bist nicht in einem fremden Casino.');
  world.activeForeignFloorId = null;
}