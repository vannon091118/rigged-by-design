/** Persistenz der Kettenlaeufe: sichere Defaults, harte Grenzen, keine Fremdzustaende. */
import { isChoiceId } from '../events/template-schema';
import { isActorRef } from '../relationships';
import type { ActorRef } from '../types';
import { isChainStatus } from './chain-schema';
import type { ChainRun, ChainRunStatus, ChainState } from './chain-types';

const MAX_RUNS = 32;
const MAX_VISITS = 20;
const MAX_REASON = 64;
const MAX_TICK = 2_000_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

function actorList(raw: unknown): ActorRef[] | null {
  if (!Array.isArray(raw) || raw.length > 16 || !raw.every(isActorRef)) return null;
  const actors = raw as ActorRef[];
  return new Set(actors).size === actors.length ? [...actors] : null;
}

function visitsOf(raw: unknown): Record<string, number> | null {
  if (!isRecord(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length > MAX_VISITS) return null;
  const visits: Record<string, number> = {};
  for (const [key, value] of entries) {
    if (!isChoiceId(key) || !isInt(value, 1, 100)) return null;
    visits[key] = value;
  }
  return visits;
}

function textOf(raw: unknown, max: number): string | null {
  return raw === null || raw === undefined ? null
    : typeof raw === 'string' && raw.length > 0 && raw.length <= max ? raw : null;
}

function runOf(raw: unknown): ChainRun | null {
  if (!isRecord(raw) || !isInt(raw.id, 1, MAX_TICK) || !isChoiceId(raw.chainId)
    || !isInt(raw.chainVersion, 1, 1000) || !isChoiceId(raw.nodeId)) return null;
  if (!isChainStatus(raw.status)) return null;
  const participants = actorList(raw.participants);
  if (!participants) return null;
  const visits = visitsOf(raw.visits);
  if (!visits) return null;
  if (!isInt(raw.startedTick, 0, MAX_TICK) || !isInt(raw.updatedTick, 0, MAX_TICK)
    || !isInt(raw.dueTick, 0, MAX_TICK) || !isInt(raw.steps, 1, 1000)) return null;
  if (raw.updatedTick < raw.startedTick || raw.dueTick < raw.startedTick) return null;
  if (raw.eventInstanceId !== null && !isInt(raw.eventInstanceId, 1, MAX_TICK)) return null;
  if (raw.sourceEventId !== null && !isInt(raw.sourceEventId, 1, MAX_TICK)) return null;
  if (raw.pendingEdgeId !== null && !isChoiceId(raw.pendingEdgeId)) return null;
  if (raw.lastChoiceId !== null && !isChoiceId(raw.lastChoiceId)) return null;
  if (raw.lastOutcomeId !== null && !isChoiceId(raw.lastOutcomeId)) return null;
  const reason = textOf(raw.reason, MAX_REASON);
  if (raw.reason !== null && reason === null) return null;
  return {
    id: raw.id,
    chainId: raw.chainId,
    chainVersion: raw.chainVersion,
    nodeId: raw.nodeId,
    eventInstanceId: raw.eventInstanceId as number | null,
    sourceEventId: raw.sourceEventId as number | null,
    status: raw.status as ChainRunStatus,
    participants,
    startedTick: raw.startedTick,
    updatedTick: raw.updatedTick,
    dueTick: raw.dueTick,
    steps: raw.steps,
    visits,
    pendingEdgeId: raw.pendingEdgeId as string | null,
    lastChoiceId: raw.lastChoiceId as string | null,
    lastOutcomeId: raw.lastOutcomeId as string | null,
    reason,
  };
}

export function createChainState(): ChainState {
  return { runs: [], runSeq: 1 };
}

/** Behaelt alle lebenden Laeufe und die neueste Historie; nie mehr als 32 Eintraege. */
export function normalizeChainState(raw: unknown): ChainState {
  const state = createChainState();
  if (!isRecord(raw) || !Array.isArray(raw.runs)) return state;
  const byId = new Map<number, ChainRun>();
  for (const entry of raw.runs) {
    const run = runOf(entry);
    if (run && !byId.has(run.id)) byId.set(run.id, run);
  }
  const sorted = [...byId.values()].sort((left, right) => left.id - right.id);
  const live = sorted.filter((run) => run.status === 'RUNNING' || run.status === 'WAITING');
  const history = sorted.filter((run) => run.status !== 'RUNNING' && run.status !== 'WAITING')
    .slice(-Math.max(0, MAX_RUNS - live.length));
  const runs = [...live, ...history].sort((left, right) => left.id - right.id).slice(-MAX_RUNS);
  const sequence = isInt(raw.runSeq, 1, MAX_TICK) ? raw.runSeq : 1;
  state.runs.push(...runs);
  state.runSeq = Math.max(sequence, ...runs.map((run) => run.id + 1), 1);
  return state;
}
