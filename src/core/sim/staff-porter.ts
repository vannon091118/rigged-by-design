/** Lagerpersonal: Kisten aufnehmen, zur passenden Bar oder ins Lager bringen. */
import type { Ledger } from '../economy/ledger';
import { depositCrate, takeCrate } from './deliveries';
import { nearestWalkable } from './pathfinding';
import type { StaffAgent, WorldState } from './types';
import { interactionPoint, worldNav } from './world';
import { dist, setTask, stepToward } from './staff-step';

export function porterTick(world: WorldState, ledger: Ledger, agent: StaffAgent): void {
  void ledger;
  const held = agent.carryingCrate !== null
    ? world.crates.find((crate) => crate.id === agent.carryingCrate) ?? null : null;
  if (!held) {
    agent.carryingCrate = null;
    const job = world.crates.find((crate) =>
      crate.carriedBy === null && crate.payload.kind !== 'FURNITURE');
    if (!job) { setTask(agent, 'idle', 'keine Kiste am Eingang'); return; }
    if (dist(agent.x, agent.y, job.x, job.y) <= 1) {
      takeCrate(world, job.id, agent.id);
      agent.carryingCrate = job.id;
      agent.path = [];
      agent.pathIndex = 0;
      setTask(agent, job.payload.kind === 'DRINKS' ? 'toBar' : 'toStorage');
    } else { setTask(agent, 'toCrate'); stepToward(world, agent, job.x, job.y); }
    return;
  }
  if (held.payload.kind === 'DRINKS') {
    const bars = world.furniture.filter((item) => item.kind === 'BAR');
    let target = bars[0];
    for (const bar of bars) {
      if (bar.stock < (target?.stock ?? Number.MAX_SAFE_INTEGER)) target = bar;
    }
    if (!target) { setTask(agent, 'idle', 'keine Bar vorhanden'); return; }
    if (dist(agent.x, agent.y, target.x, target.y) <= 3) {
      try {
        const done = depositCrate(world, held.id, agent.x, agent.y, target.id);
        if (done.emptied) agent.carryingCrate = null;
        setTask(agent, 'toBar');
      } catch { setTask(agent, 'toBar', 'Bar voll'); agent.path = []; agent.pathIndex = 0; }
      return;
    }
    const spot = interactionPoint(world, target);
    setTask(agent, 'toBar');
    if (spot) stepToward(world, agent, spot.x, spot.y);
    return;
  }
  const storage = world.zones.find((zone) => zone.id === 'storage');
  if (storage && agent.x >= storage.x && agent.y >= storage.y
    && agent.x < storage.x + storage.w && agent.y < storage.y + storage.h) {
    try {
      depositCrate(world, held.id, agent.x, agent.y);
      agent.carryingCrate = null;
      setTask(agent, 'toStorage');
    } catch { setTask(agent, 'toStorage', 'Lager voll oder blockiert'); }
    return;
  }
  if (storage) {
    setTask(agent, 'toStorage');
    const spot = nearestWalkable(worldNav(world),
      { x: storage.x + Math.floor(storage.w / 2), y: storage.y + Math.floor(storage.h / 2) });
    if (spot) stepToward(world, agent, spot.x, spot.y);
  }
}
