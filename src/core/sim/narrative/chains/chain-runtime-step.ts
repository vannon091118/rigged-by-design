/**
 * Ein einzelner Kettenlauf: verzoegern, Bedingungen auswerten, verzweigen oder
 * zusammenfuehren. Die Funktion plant hoechstens einen Uebergang pro Aufruf.
 */
import type { Ledger } from '../../../economy/ledger';
import type { InfluenceConfig } from '../../influence';
import type { WorldState } from '../../types';
import { isLiveEventStatus } from '../event-lifecycle';
import type { NarrativeEventInstance } from '../event-types';
import type { NarrativeFact } from '../types';
import { chainContext } from './chain-context';
import { evaluateChainCondition } from './chain-conditions';
import { chainNode, outgoingEdges } from './chain-graph';
import { chainFor } from './definitions';
import type { ChainEdge, ChainRun, NarrativeChain } from './chain-types';
import { endRun, replaceRun } from './chain-runtime-state';
import { forkRun, schedulePending } from './chain-runtime-schedule';

type ResolvedFact = Extract<NarrativeFact, { kind: 'EVENT_RESOLVED' }>;

function moveTo(
  world: WorldState,
  ledger: Ledger,
  chain: NarrativeChain,
  run: ChainRun,
  edge: ChainEdge,
  tick: number,
  config: InfluenceConfig,
  scheduled: NarrativeEventInstance[],
  lastChoiceId: string | null,
  lastOutcomeId: string | null,
): ChainRun {
  if (run.steps >= chain.maxSteps) return endRun(world, run, tick, 'ABORTED', 'LIMIT');
  const dueTick = tick + Math.max(0, edge.delayTicks ?? 0);
  const next: ChainRun = {
    ...run,
    nodeId: edge.to,
    eventInstanceId: null,
    sourceEventId: run.eventInstanceId ?? run.sourceEventId,
    status: 'WAITING',
    dueTick,
    steps: run.steps + 1,
    visits: { ...run.visits, [edge.to]: (run.visits[edge.to] ?? 0) + 1 },
    pendingEdgeId: edge.edgeId,
    lastChoiceId,
    lastOutcomeId,
    updatedTick: tick,
    reason: null,
  };
  const stored = replaceRun(world, run.id, next) ?? next;
  if (dueTick > tick) return stored;
  return schedulePending(world, ledger, chain, stored, tick, config, scheduled);
}

export function advanceRun(
  world: WorldState,
  ledger: Ledger,
  run: ChainRun,
  tick: number,
  config: InfluenceConfig,
  scheduled: NarrativeEventInstance[],
): ChainRun {
  const chain = chainFor(run.chainId, run.chainVersion);
  if (!chain) return endRun(world, run, tick, 'ABORTED', 'MISSING_CHAIN');
  if (tick - run.startedTick > chain.maxDurationTicks) return endRun(world, run, tick, 'ABORTED', 'LIMIT');
  // Eine Verzoegerung ist eine echte Ruhephase: vor `dueTick` wird nichts geplant.
  if (run.status === 'WAITING' && run.dueTick > tick) return run;
  if (run.eventInstanceId === null) return schedulePending(world, ledger, chain, run, tick, config, scheduled);
  const event = world.narrative.events.find((entry) => entry.id === run.eventInstanceId);
  if (!event) return endRun(world, run, tick, 'ABORTED', 'MISSING_EVENT');
  if (isLiveEventStatus(event.status) || event.status === 'ELIGIBLE') return run;
  if (event.status !== 'RESOLVED') return endRun(world, run, tick, 'ABORTED', 'INTERRUPTED');
  const node = chainNode(chain, run.nodeId);
  if (!node) return endRun(world, run, tick, 'ABORTED', 'MISSING_NODE');
  const fact = world.narrative.recent.find(
    (entry): entry is ResolvedFact => entry.kind === 'EVENT_RESOLVED' && entry.eventId === event.id,
  );
  const lastChoiceId = fact?.choiceId ?? run.lastChoiceId;
  const lastOutcomeId = fact?.outcomeId ?? event.resolution ?? run.lastOutcomeId;
  const context = chainContext(world, ledger, { ...run, lastChoiceId, lastOutcomeId }, config);
  if (chain.abort && evaluateChainCondition(chain.abort, context).matched) {
    return endRun(world, run, tick, 'ABORTED', 'ABORT_CONDITION');
  }
  if (node.abort && evaluateChainCondition(node.abort, context).matched) {
    return endRun(world, run, tick, 'ABORTED', 'ABORT_CONDITION');
  }
  const eligible = outgoingEdges(chain, run.nodeId)
    .filter((edge) => edge.repeatable === true || (run.visits[edge.to] ?? 0) === 0)
    .filter((edge) => edge.when === undefined || evaluateChainCondition(edge.when, context).matched);
  if (eligible.length === 0) return endRun(world, run, tick, 'COMPLETED', 'END');
  const parallel = eligible.filter((edge) => edge.parallel === true);
  if (parallel.length >= 2) return forkRun(world, run, parallel, tick, lastChoiceId, lastOutcomeId);
  const selected = eligible[0]!;
  return moveTo(world, ledger, chain, run, selected, tick, config, scheduled, lastChoiceId, lastOutcomeId);
}
