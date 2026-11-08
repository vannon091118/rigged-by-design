/**
 * Zustandshelfer der Ereignisketten: begrenzen, ersetzen, beenden. Reine
 * Buchhaltung ohne Uebergangslogik, damit Laufzeit und Schritt getrennt bleiben.
 */
import type { WorldState } from '../../types';
import type { ChainRun, NarrativeChain } from './chain-types';

const MAX_RUNS = 32;

export const isActive = (run: ChainRun): boolean =>
  run.status === 'RUNNING' || run.status === 'WAITING';

const participantsKey = (participants: readonly string[]): string =>
  [...participants].sort().join('|');

export function replaceRun(world: WorldState, id: number, next: ChainRun): ChainRun | null {
  const runs = world.narrative.chains.runs;
  const index = runs.findIndex((run) => run.id === id);
  if (index < 0) return null;
  runs[index] = next;
  return next;
}

export function endRun(
  world: WorldState,
  run: ChainRun,
  tick: number,
  status: 'COMPLETED' | 'ABORTED',
  reason: string,
): ChainRun {
  const next: ChainRun = {
    ...run, status, reason, eventInstanceId: null, pendingEdgeId: null,
    updatedTick: tick, dueTick: tick,
  };
  return replaceRun(world, run.id, next) ?? next;
}

export function hasCapacity(world: WorldState): boolean {
  const runs = world.narrative.chains.runs;
  if (runs.length < MAX_RUNS) return true;
  const finished = runs.filter((run) => !isActive(run))
    .sort((left, right) => left.updatedTick - right.updatedTick);
  const oldest = finished[0];
  if (!oldest) return false;
  runs.splice(runs.indexOf(oldest), 1);
  return true;
}

export function hasRun(
  world: WorldState,
  chain: NarrativeChain,
  participants: readonly string[],
  tick: number,
): boolean {
  const key = participantsKey(participants);
  const runs = world.narrative.chains.runs
    .filter((run) => run.chainId === chain.chainId && participantsKey(run.participants) === key);
  if (runs.length === 0) return false;
  if (!chain.repeatable) return true;
  if (runs.some(isActive)) return true;
  const latest = runs.reduce((max, run) => Math.max(max, run.updatedTick), 0);
  return tick < latest + chain.cooldownTicks;
}

export function pruneRuns(world: WorldState): void {
  const runs = world.narrative.chains.runs;
  if (runs.length <= MAX_RUNS) return;
  const active = runs.filter(isActive);
  const history = runs.filter((run) => !isActive(run))
    .sort((left, right) => right.updatedTick - left.updatedTick)
    .slice(0, Math.max(0, MAX_RUNS - active.length));
  world.narrative.chains.runs = [...active, ...history].sort((left, right) => left.id - right.id);
}
