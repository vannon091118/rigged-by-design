/** Anlegen, Normalisieren und Nachschlagen der Rivalen-Zustaende; ohne Spielwirkung. */
import { RIVAL_IDS, type RivalId } from '../types-model';
import { clamp } from '../num';
import {
  RIVAL_ACTION_IDS, RIVAL_AI_LIMITS, RIVAL_STANCES,
  type RivalActionId, type RivalActionRecord, type RivalEvidence, type RivalMindState, type RivalStance,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function integer(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function tickOf(value: unknown): number {
  const tick = integer(value, 0);
  return Number.isSafeInteger(tick) && tick >= 0 ? tick : 0;
}

function actionOf(value: unknown): RivalActionId | null {
  return typeof value === 'string' && (RIVAL_ACTION_IDS as readonly string[]).includes(value)
    ? (value as RivalActionId) : null;
}

function stanceOf(value: unknown): RivalStance | null {
  return typeof value === 'string' && (RIVAL_STANCES as readonly string[]).includes(value)
    ? (value as RivalStance) : null;
}

const textOf = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');

function normalizeEvidence(raw: unknown): RivalEvidence[] {
  if (!Array.isArray(raw)) return [];
  const evidence: RivalEvidence[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const action = actionOf(entry.action);
    if (!action) continue;
    const machineId = Number.isSafeInteger(entry.machineId) && (entry.machineId as number) > 0
      ? (entry.machineId as number) : null;
    evidence.push({
      action,
      tick: tickOf(entry.tick),
      day: tickOf(entry.day),
      machineId,
      blocked: entry.blocked === true,
      note: textOf(entry.note, 120),
    });
  }
  return evidence.slice(-RIVAL_AI_LIMITS.evidence);
}

function normalizeHistory(raw: unknown): RivalActionRecord[] {
  if (!Array.isArray(raw)) return [];
  const history: RivalActionRecord[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const action = actionOf(entry.action);
    if (!action) continue;
    history.push({
      action, tick: tickOf(entry.tick), day: tickOf(entry.day), summary: textOf(entry.summary, 120),
    });
  }
  return history.slice(-RIVAL_AI_LIMITS.history);
}

function createRivalMind(rivalId: RivalId): RivalMindState {
  return {
    rivalId,
    stance: 'NEUTRAL',
    capacity: RIVAL_AI_LIMITS.startCapacity,
    goodwill: 0,
    nextActionTick: RIVAL_AI_LIMITS.firstActionTick,
    counteredUntilTick: 0,
    history: [],
    evidence: [],
  };
}

export function createRivalMinds(): RivalMindState[] {
  return RIVAL_IDS.map(createRivalMind);
}

/** Jede ID genau einmal; fehlende IDs bekommen den Startzustand, Unbekanntes faellt weg. */
export function normalizeRivalMinds(raw: unknown): RivalMindState[] {
  const byId = new Map<RivalId, RivalMindState>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isRecord(entry) || typeof entry.rivalId !== 'string') continue;
      if (!(RIVAL_IDS as readonly string[]).includes(entry.rivalId)) continue;
      const rivalId = entry.rivalId as RivalId;
      if (byId.has(rivalId)) continue;
      byId.set(rivalId, {
        rivalId,
        stance: stanceOf(entry.stance) ?? 'NEUTRAL',
        capacity: clamp(integer(entry.capacity, RIVAL_AI_LIMITS.startCapacity),
          RIVAL_AI_LIMITS.capacityMin, RIVAL_AI_LIMITS.capacityMax),
        goodwill: clamp(integer(entry.goodwill, 0), RIVAL_AI_LIMITS.goodwillMin, RIVAL_AI_LIMITS.goodwillMax),
        nextActionTick: tickOf(entry.nextActionTick),
        counteredUntilTick: tickOf(entry.counteredUntilTick),
        history: normalizeHistory(entry.history),
        evidence: normalizeEvidence(entry.evidence),
      });
    }
  }
  return RIVAL_IDS.map((rivalId) => byId.get(rivalId) ?? createRivalMind(rivalId));
}
