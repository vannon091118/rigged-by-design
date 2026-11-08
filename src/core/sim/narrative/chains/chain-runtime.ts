/**
 * Laufzeit der Ereignisketten: startet nur aus aufgeloesten Events und treibt
 * jeden lebenden Lauf hoechstens einmal pro Durchgang. Keine Rekursion, kein
 * globaler RNG; Verzoegerung und Zustand entscheiden ueber die Fortsetzung.
 */
import type { Ledger } from '../../../economy/ledger';
import type { InfluenceConfig } from '../../influence';
import type { WorldState } from '../../types';
import type { NarrativeEventInstance } from '../event-types';
import { chainNode } from './chain-graph';
import { NARRATIVE_CHAINS } from './definitions';
import {
  hasCapacity, hasRun, isActive, pruneRuns,
} from './chain-runtime-state';
import { advanceRun } from './chain-runtime-step';

export interface ChainAdvanceResult {
  readonly started: number;
  readonly scheduled: readonly NarrativeEventInstance[];
  readonly completed: number;
  readonly aborted: number;
}

/** Ein Lauf beginnt nur aus einem tatsaechlich aufgeloesten Event, nie aus Zeit allein. */
function startRuns(world: WorldState, tick: number, resolvedEventIds: ReadonlySet<number>): number {
  let started = 0;
  for (const eventId of resolvedEventIds) {
    const event = world.narrative.events.find((entry) => entry.id === eventId);
    if (!event || event.status !== 'RESOLVED') continue;
    for (const chain of NARRATIVE_CHAINS) {
      const start = chainNode(chain, chain.start);
      if (!start || start.eventId !== event.eventId) continue;
      if (hasRun(world, chain, event.participants, tick) || !hasCapacity(world)) continue;
      world.narrative.chains.runs.push({
        id: world.narrative.chains.runSeq,
        chainId: chain.chainId,
        chainVersion: chain.version,
        nodeId: chain.start,
        eventInstanceId: event.id,
        sourceEventId: event.id,
        status: 'RUNNING',
        participants: [...event.participants],
        startedTick: tick,
        updatedTick: tick,
        dueTick: tick,
        steps: 1,
        visits: { [chain.start]: 1 },
        pendingEdgeId: null,
        lastChoiceId: null,
        lastOutcomeId: null,
        reason: null,
      });
      world.narrative.chains.runSeq += 1;
      started += 1;
    }
  }
  return started;
}

/**
 * Genau ein Durchlauf: neue Laeufe aus aufgeloesten Events, dann jeder lebende
 * Lauf hoechstens einmal. Verzoegerte Laeufe werden auch ohne neuen Fact
 * faellig, deshalb ist der Aufruf nicht an `facts.length > 0` gebunden.
 */
export function advanceChains(
  world: WorldState,
  ledger: Ledger,
  tick: number,
  config: InfluenceConfig,
  resolvedEventIds: ReadonlySet<number>,
): ChainAdvanceResult {
  const started = startRuns(world, tick, resolvedEventIds);
  const ids = world.narrative.chains.runs.filter(isActive).map((run) => run.id);
  const scheduled: NarrativeEventInstance[] = [];
  let completed = 0;
  let aborted = 0;
  for (const id of ids) {
    const run = world.narrative.chains.runs.find((entry) => entry.id === id);
    if (!run || !isActive(run)) continue;
    const next = advanceRun(world, ledger, run, tick, config, scheduled);
    if (next.status === 'COMPLETED') completed += 1;
    if (next.status === 'ABORTED') aborted += 1;
  }
  pruneRuns(world);
  return { started, scheduled, completed, aborted };
}
