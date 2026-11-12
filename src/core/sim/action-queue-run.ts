/** Ausfuehrung der Auftragskette: Annaeherung, Werkzeug, Arbeit und Rueckgabe. */
import type { Ledger } from '../economy/ledger';
import { activePlayerPosition } from './active-player';
import { approachTarget, planInteraction, stopPlayer, type InteractionTarget } from './interaction';
import { consumeMopUse, dropMop, pickupMop } from './mop';
import { removeStain, type Stain } from './stain';
import { movePlayer } from './player';
import type { WorldState } from './types';
import { arrived, hasMop, labelOf, type ActionTask, type TaskStatus } from './action-queue-types';
import { toiletTarget, toolTarget } from './action-queue-tools';

function nextStain(world: WorldState, task: ActionTask): Stain | null {
  while (task.cursor < (task.stainIds?.length ?? 0)) {
    const id = task.stainIds![task.cursor]!;
    const stain = world.stains.find((entry) => entry.id === id);
    if (stain) return stain;
    task.cursor += 1;
  }
  return null;
}

function finish(world: WorldState, task: ActionTask, status: TaskStatus, failure = ''): void {
  task.status = status;
  task.failure = failure;
  task.step = 'DONE';
  world.actionQueue.tasks = world.actionQueue.tasks.filter((entry) => entry.id !== task.id);
  world.actionQueue.last = task;
  if (status === 'FAILED') world.lastEvent = `Auftrag fehlgeschlagen: ${failure}`;
  else if (status === 'COMPLETED') world.lastEvent = `${labelOf(task)} erledigt.`;
  const next = world.actionQueue.tasks[0];
  if (next && next.status === 'QUEUED') next.status = 'ACTIVE';
  if (!world.actionQueue.tasks.length) stopPlayer(world);
}

function stepTool(world: WorldState, task: ActionTask): void {
  if (hasMop(world)) {
    if (task.kind === 'GET_MOP') finish(world, task, 'COMPLETED');
    else task.step = 'TO_TARGET';
    return;
  }
  if (world.player.carrying !== '') {
    finish(world, task, 'FAILED', 'Deine Hände sind voll.');
    return;
  }
  const requested = task.target?.kind === 'mop'
    ? world.mops.find((mop) => mop.id === task.target!.id && mop.carriedBy === null)
    : null;
  const target = requested ? { kind: 'mop' as const, id: requested.id } : toolTarget(world);
  if (!target) {
    finish(world, task, 'FAILED', 'Kein Wischer und keine Toilette vorhanden.');
    return;
  }
  if (planInteraction(world, target).inRange) {
    pickupMop(world, target.id);
    if (task.kind === 'GET_MOP') finish(world, task, 'COMPLETED');
    else task.step = 'TO_TARGET';
    return;
  }
  if (arrived(world) && !approachTarget(world, target).reachable) {
    finish(world, task, 'FAILED', 'Der Wischer ist nicht erreichbar.');
  }
}

function stepReturn(world: WorldState, task: ActionTask): void {
  if (!hasMop(world)) {
    finish(world, task, 'COMPLETED');
    return;
  }
  const target = toiletTarget(world);
  if (!target) {
    finish(world, task, 'FAILED', 'Keine Toilette zum Ablegen gefunden.');
    return;
  }
  if (planInteraction(world, target).inRange) {
    dropMop(world);
    finish(world, task, 'COMPLETED');
    return;
  }
  if (arrived(world) && !approachTarget(world, target).reachable) {
    finish(world, task, 'FAILED', 'Die Toilette ist nicht erreichbar.');
  }
}

function stepClean(world: WorldState, ledger: Ledger, task: ActionTask): void {
  if (task.step === 'TO_TOOL') { stepTool(world, task); return; }
  if (task.step === 'RETURN') { stepReturn(world, task); return; }
  if (task.step !== 'TO_TARGET' && task.step !== 'WORK') return;
  if (!hasMop(world) && task.step === 'TO_TARGET') { task.step = 'TO_TOOL'; return; }
  const stain = nextStain(world, task);
  if (!stain) { task.step = 'RETURN'; return; }
  const target: InteractionTarget = { kind: 'stain', id: stain.id };
  if (task.step === 'TO_TARGET') {
    if (planInteraction(world, target).inRange) {
      task.step = 'WORK';
      task.total = stain.removeDurationTicks;
      task.remaining = Math.max(1, Math.floor(stain.removeDurationTicks));
      return;
    }
    if (arrived(world) && !approachTarget(world, target).reachable) {
      finish(world, task, 'FAILED', 'Der Fleck ist nicht erreichbar.');
    }
    return;
  }
  task.remaining -= 1;
  if (task.remaining > 0) return;
  removeStain(world, ledger, stain.id);
  consumeMopUse(world);
  task.cursor += 1;
  task.step = 'TO_TARGET';
  task.total = 0;
  task.remaining = 0;
}

export function tickActionQueue(world: WorldState, ledger: Ledger): void {
  const task = world.actionQueue.tasks[0];
  if (!task || task.status !== 'ACTIVE') return;
  try {
    if (task.kind === 'MOVE') {
      if (!task.point) { finish(world, task, 'FAILED', 'Kein Laufziel.'); return; }
      if (arrived(world)) {
        const position = activePlayerPosition(world);
        const distance = Math.abs(position.x - task.point.x) + Math.abs(position.y - task.point.y);
        if (distance <= 1) finish(world, task, 'COMPLETED');
        else movePlayer(world, task.point);
      }
      return;
    }
    if (task.kind === 'GET_MOP') { stepTool(world, task); return; }
    if (task.kind === 'RETURN_MOP') { stepReturn(world, task); return; }
    stepClean(world, ledger, task);
  } catch (error) {
    finish(world, task, 'FAILED', error instanceof Error ? error.message : 'Auftrag fehlgeschlagen.');
  }
}

export function clearActionQueue(world: WorldState): void {
  if (world.actionQueue.tasks.length === 0) return;
  world.actionQueue.tasks = [];
  stopPlayer(world);
}

export function cancelTask(world: WorldState, taskId: string): boolean {
  const index = world.actionQueue.tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return false;
  const [task] = world.actionQueue.tasks.splice(index, 1);
  if (!task) return false;
  task.status = 'CANCELLED';
  task.failure = 'Vom Spieler abgebrochen.';
  world.actionQueue.last = task;
  if (index === 0) stopPlayer(world);
  const next = world.actionQueue.tasks[0];
  if (next && next.status === 'QUEUED') next.status = 'ACTIVE';
  world.lastEvent = `${labelOf(task)} abgebrochen.`;
  return true;
}
