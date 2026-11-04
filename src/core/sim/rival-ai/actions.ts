/**
 * Fuehrt eine geplante Rivalenaktion aus. Jede Wirkung ist benannt und belegt:
 * Schaden trifft genau ein Geraet, jedes Sabotage-Indiz landet in `evidence`,
 * jede Aktion erzeugt genau einen RIVAL_ACTION-Fact und eine Journal-Zeile.
 */
import { recordJournal } from '../journal';
import { actorRefOfRival } from '../narrative/relationships';
import { emitFact } from '../narrative/facts';
import { dirtyTileIndex } from '../emotion';
import { hasActiveGuard } from '../staff-queries';
import type { WorldState } from '../types';
import type { RivalActionPlan } from './policy';
import {
  RIVAL_AI_LIMITS, type RivalActionRecord, type RivalEvidence, type RivalMindState,
} from './types';

/** Fester Sabotageschaden: kein Wuerfelwurf, damit Indiz und Wirkung zusammenpassen. */
const SABOTAGE_DAMAGE = 12;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function recordEvidence(mind: RivalMindState, world: WorldState, entry: RivalEvidence): void {
  mind.evidence.push(entry);
  const overflow = mind.evidence.length - RIVAL_AI_LIMITS.evidence;
  if (overflow > 0) mind.evidence.splice(0, overflow);
}

interface SabotageOutcome {
  readonly machineId: number | null;
  readonly blocked: boolean;
  readonly note: string;
}

/** Ziel ist das beste unbeschaedigte Geraet: reproduzierbar, nicht zufaellig. */
function sabotage(world: WorldState, machineId: number | null): SabotageOutcome {
  const target = machineId === null ? null : world.furniture.find((item) => item.id === machineId) ?? null;
  if (!target) return { machineId: null, blocked: false, note: 'Der Saboteur fand kein Ziel.' };
  const blocked = hasActiveGuard(world);
  if (!blocked) {
    target.condition = Math.max(0, target.condition - SABOTAGE_DAMAGE);
    target.damaged = true;
    world.dirty.add(dirtyTileIndex(world.size, target.x, target.y));
  }
  return {
    machineId: target.id,
    blocked,
    note: blocked
      ? `Der Guard verhinderte den Sabotageversuch an ${target.label}.`
      : `${target.label} nahm ${SABOTAGE_DAMAGE} Schaden durch Sabotage.`,
  };
}

/** Schreibt Aktion, Indiz, Journal und Fact; die Beziehung setzt der Boundary aus dem Fact. */
export function applyRivalAction(
  world: WorldState,
  mind: RivalMindState,
  plan: RivalActionPlan,
): RivalActionRecord {
  const hit = plan.action === 'SABOTAGE' ? sabotage(world, plan.machineId) : null;
  const note = hit ? hit.note : plan.note;
  if (plan.action === 'SABOTAGE' && hit?.machineId !== null) {
    recordEvidence(mind, world, {
      action: 'SABOTAGE', tick: world.tick, day: world.day,
      machineId: hit.machineId, blocked: hit.blocked, note,
    });
  }
  recordJournal(world, {
    kind: 'RIVAL',
    subject: mind.rivalId,
    cause: plan.action === 'SABOTAGE' ? (hit?.blocked ? 'Vereitelte Sabotage' : 'Sabotage') : plan.note,
    effect: note,
    refs: hit?.machineId === null
      ? { rivalId: mind.rivalId }
      : { rivalId: mind.rivalId, furnitureId: hit?.machineId ?? undefined },
  });
  emitFact(world, {
    kind: 'RIVAL_ACTION',
    actorRefs: [actorRefOfRival(mind.rivalId)],
    rivalId: mind.rivalId,
    action: plan.action,
    evidence: plan.action === 'SABOTAGE',
    machineId: hit?.machineId ?? null,
  });
  const record: RivalActionRecord = { action: plan.action, tick: world.tick, day: world.day, summary: note };
  mind.history.push(record);
  const overflow = mind.history.length - RIVAL_AI_LIMITS.history;
  if (overflow > 0) mind.history.splice(0, overflow);
  mind.capacity = clamp(mind.capacity + plan.capacityDelta, RIVAL_AI_LIMITS.capacityMin, RIVAL_AI_LIMITS.capacityMax);
  mind.goodwill = clamp(mind.goodwill + plan.goodwillDelta, RIVAL_AI_LIMITS.goodwillMin, RIVAL_AI_LIMITS.goodwillMax);
  mind.stance = plan.stance;
  mind.nextActionTick = plan.nextActionTick;
  return record;
}

/** Bestes unbeschaedigtes Geraet als Sabotageziel; Gleichstand geht an die kleinste ID. */
export function sabotageTarget(world: WorldState): number | null {
  const candidates = world.furniture
    .filter((item) => Boolean(item.gameId) && !item.damaged)
    .sort((a, b) => b.condition - a.condition || a.id - b.id);
  return candidates[0]?.id ?? null;
}
