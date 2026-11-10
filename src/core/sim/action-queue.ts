/**
 * Action Queue: serialisierbare Auftraege, kein React-State.
 * Die Daten liegen in action-queue-types, die Ausfuehrung in action-queue-run.
 */
import type { InteractionTarget } from './interaction';
import type { WorldState } from './types';
import type { ActionQueueState, ActionTask, TaskKind } from './action-queue-types';

export type {
  ActionQueueState, ActionTask, ActionTaskView, TaskKind, TaskStatus, TaskStep,
} from './action-queue-types';
export { createActionQueue, normalizeActionQueue, queueView } from './action-queue-types';
export { cancelTask, tickActionQueue } from './action-queue-run';

interface EnqueueInput {
  readonly kind: TaskKind;
  readonly target?: InteractionTarget;
  readonly point?: { readonly x: number; readonly y: number };
  readonly stainIds?: readonly number[];
}

function stainTotal(world: WorldState, stainId: number): number {
  return world.stains.find((stain) => stain.id === stainId)?.removeDurationTicks ?? 0;
}

export function enqueueTask(world: WorldState, input: EnqueueInput): ActionTask {
  const queue: ActionQueueState = world.actionQueue;
  const stainIds = input.kind === 'CLEAN_ROOM'
    ? (input.stainIds ?? world.stains.map((stain) => stain.id))
    : input.kind === 'CLEAN_STAIN' && input.target ? [input.target.id] : [];
  if (input.kind === 'CLEAN_STAIN' && stainIds.length === 0) throw new Error('Der Fleck ist nicht mehr da.');
  if (input.kind === 'CLEAN_ROOM' && stainIds.length === 0) throw new Error('Hier ist nichts zu reinigen.');
  if (input.kind === 'MOVE' && !input.point) throw new Error('Kein Laufziel.');
  const task: ActionTask = {
    id: `task-${queue.nextId++}`,
    kind: input.kind,
    target: input.target,
    point: input.point,
    stainIds,
    createdAtTick: world.tick,
    status: queue.tasks.length === 0 ? 'ACTIVE' : 'QUEUED',
    step: input.kind === 'RETURN_MOP' ? 'RETURN' : input.kind === 'MOVE' ? 'TO_TARGET' : 'TO_TOOL',
    cursor: 0,
    remaining: stainIds.length > 0 ? stainTotal(world, stainIds[0]!) : 0,
    total: stainIds.length > 0 ? stainTotal(world, stainIds[0]!) : 0,
    failure: '',
  };
  queue.tasks.push(task);
  world.lastEvent = `${task.kind === 'MOVE' ? 'Laufziel' : 'Auftrag'} eingereiht.`;
  return task;
}


