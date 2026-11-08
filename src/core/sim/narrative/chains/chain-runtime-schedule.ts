/**
 * Planung von Kettenknoten: Teilnehmer verengen, Bedingungen bei Faelligkeit
 * erneut pruefen, Event anlegen und parallele Zweige als unabhaengige Kinder.
 */
import type { Ledger } from '../../../economy/ledger';
import type { InfluenceConfig } from '../../influence';
import type { WorldState } from '../../types';
import { offerChoiceIds } from '../choices/contract';
import { scheduleEvent } from '../event-scheduler';
import { templateFor } from '../events/definitions';
import { resolveParticipants } from '../events/template-candidate';
import type { EventCandidate, NarrativeEventInstance } from '../event-types';
import type { ActorRef } from '../types';
import { chainContext } from './chain-context';
import { evaluateChainCondition } from './chain-conditions';
import { chainNode } from './chain-graph';
import type {
  ChainEdge, ChainParticipantMode, ChainRun, NarrativeChain,
} from './chain-types';
import { endRun, hasCapacity, replaceRun } from './chain-runtime-state';

const MAX_FORK_EDGES = 2;

function narrow(participants: readonly ActorRef[], mode: ChainParticipantMode): readonly ActorRef[] {
  if (mode === 'first') return participants.slice(0, 1);
  if (mode === 'last') return participants.slice(-1);
  return participants;
}

export function schedulePending(
  world: WorldState,
  ledger: Ledger,
  chain: NarrativeChain,
  run: ChainRun,
  tick: number,
  config: InfluenceConfig,
  scheduled: NarrativeEventInstance[],
): ChainRun {
  const edge = chain.edges.find((entry) => entry.edgeId === run.pendingEdgeId);
  if (!edge) return endRun(world, run, tick, 'ABORTED', 'MISSING_EDGE');
  const node = chainNode(chain, run.nodeId);
  if (!node) return endRun(world, run, tick, 'ABORTED', 'MISSING_NODE');
  const context = chainContext(world, ledger, run, config);
  if (chain.abort && evaluateChainCondition(chain.abort, context).matched) {
    return endRun(world, run, tick, 'ABORTED', 'ABORT_CONDITION');
  }
  if (node.abort && evaluateChainCondition(node.abort, context).matched) {
    return endRun(world, run, tick, 'ABORTED', 'ABORT_CONDITION');
  }
  // Eine ruhende Kette wird bei Faelligkeit erneut geprueft; der alte Beschluss
  // allein darf sie nicht mehr bis zum Ende abspielen.
  if (edge.when && !evaluateChainCondition(edge.when, context).matched) {
    return endRun(world, run, tick, 'COMPLETED', 'EDGE_INVALIDATED');
  }
  const template = templateFor(node.eventId);
  if (!template) return endRun(world, run, tick, 'ABORTED', 'MISSING_TEMPLATE');
  const participants = resolveParticipants(
    template.participantRoles,
    narrow(run.participants, node.participantMode ?? 'inherit'),
  );
  if (!participants) return endRun(world, run, tick, 'ABORTED', 'PARTICIPANT_MISMATCH');
  const source = run.sourceEventId === null
    ? null
    : world.narrative.events.find((event) => event.id === run.sourceEventId) ?? null;
  const candidate: EventCandidate = {
    eventId: template.eventId,
    templateId: template.eventId,
    templateVersion: template.version,
    offeredChoiceIds: [...offerChoiceIds(template)],
    priority: template.priority,
    scope: template.scope,
    participants,
    sourceFactId: source?.sourceFactId ?? 0,
    expiresInTicks: template.expiresInTicks,
    cooldownTicks: template.cooldownTicks,
    maxOccurrences: template.maxOccurrences,
    chainFromEventId: run.sourceEventId,
    step: template.initialStep,
  };
  const event = scheduleEvent(world, candidate, 'OFFERED', tick);
  if (!event) return endRun(world, run, tick, 'COMPLETED', 'BLOCKED');
  scheduled.push(event);
  const next: ChainRun = {
    ...run, eventInstanceId: event.id, status: 'RUNNING', pendingEdgeId: null,
    updatedTick: tick, dueTick: tick, reason: null,
  };
  return replaceRun(world, run.id, next) ?? next;
}

/** Teilt einen Lauf in unabhaengige Kinder; der Elternlauf endet als Zusammenfuehrungspunkt. */
export function forkRun(
  world: WorldState,
  run: ChainRun,
  edges: readonly ChainEdge[],
  tick: number,
  lastChoiceId: string | null,
  lastOutcomeId: string | null,
): ChainRun {
  const parent = endRun(world, run, tick, 'COMPLETED', 'FORK');
  for (const edge of edges.slice(0, MAX_FORK_EDGES)) {
    if (!hasCapacity(world)) break;
    world.narrative.chains.runs.push({
      id: world.narrative.chains.runSeq,
      chainId: run.chainId,
      chainVersion: run.chainVersion,
      nodeId: edge.to,
      eventInstanceId: null,
      sourceEventId: run.eventInstanceId ?? run.sourceEventId,
      status: 'WAITING',
      participants: [...run.participants],
      startedTick: run.startedTick,
      updatedTick: tick,
      dueTick: tick + Math.max(0, edge.delayTicks ?? 0),
      steps: run.steps + 1,
      visits: { ...run.visits, [edge.to]: (run.visits[edge.to] ?? 0) + 1 },
      pendingEdgeId: edge.edgeId,
      lastChoiceId,
      lastOutcomeId,
      reason: null,
    });
    world.narrative.chains.runSeq += 1;
  }
  return parent;
}
