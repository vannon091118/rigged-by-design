/** Datenvertrag der Auftragskette; die Ausfuehrung liegt in action-queue-run. */
import type { InteractionTarget } from './interaction';
import type { Point, WorldState } from './types';

export type TaskStatus = 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'CANCELLED';
export type TaskKind = 'MOVE' | 'CLEAN_STAIN' | 'CLEAN_ROOM' | 'GET_MOP' | 'RETURN_MOP';
export type TaskStep = 'TO_TOOL' | 'TO_TARGET' | 'WORK' | 'RETURN' | 'DONE';

export interface ActionTask {
  readonly id: string;
  readonly kind: TaskKind;
  readonly target?: InteractionTarget;
  readonly point?: Point;
  readonly stainIds?: readonly number[];
  readonly createdAtTick: number;
  status: TaskStatus;
  step: TaskStep;
  cursor: number;
  remaining: number;
  total: number;
  failure: string;
}

export interface ActionQueueState {
  tasks: ActionTask[];
  nextId: number;
  last: ActionTask | null;
}

export interface ActionTaskView {
  readonly id: string;
  readonly kind: TaskKind;
  readonly status: TaskStatus;
  readonly step: TaskStep;
  readonly label: string;
  readonly detail: string;
  readonly progress: number;
}

export function createActionQueue(): ActionQueueState {
  return { tasks: [], nextId: 1, last: null };
}

export function normalizeActionQueue(raw: unknown): ActionQueueState {
  const value = raw as Partial<ActionQueueState> | null;
  if (!value || !Array.isArray(value.tasks)) return createActionQueue();
  const tasks = value.tasks.filter((task): task is ActionTask =>
    !!task && typeof task.id === 'string' && typeof task.kind === 'string'
    && typeof task.status === 'string' && Number.isSafeInteger(task.cursor)
    && Number.isSafeInteger(task.remaining) && Number.isSafeInteger(task.total));
  if (tasks.length > 0 && tasks[0]!.status === 'QUEUED') tasks[0]!.status = 'ACTIVE';
  const nextId = Number.isSafeInteger(value.nextId) && value.nextId! > 0
    ? value.nextId!
    : tasks.reduce((max, task) => Math.max(max, Number(task.id.replace(/\D/g, '')) + 1), 1);
  return { tasks, nextId, last: value.last && typeof value.last.id === 'string' ? value.last : null };
}

export function labelOf(task: ActionTask): string {
  if (task.kind === 'MOVE') return 'Hierhin laufen';
  if (task.kind === 'GET_MOP') return 'Wischer holen';
  if (task.kind === 'RETURN_MOP') return 'Wischer zurückbringen';
  if (task.kind === 'CLEAN_ROOM') return 'Raum reinigen';
  return 'Fleck reinigen';
}

function detailOf(task: ActionTask): string {
  if (task.status === 'FAILED') return task.failure || 'Auftrag fehlgeschlagen.';
  if (task.status === 'BLOCKED') return task.failure || 'Auftrag blockiert.';
  if (task.status === 'COMPLETED') return 'Erledigt.';
  if (task.status === 'CANCELLED') return 'Abgebrochen.';
  if (task.step === 'TO_TOOL') return 'Wischer holen …';
  if (task.step === 'TO_TARGET') return 'Zum Ziel laufen …';
  if (task.step === 'WORK') return task.total > 0 ? `Arbeit ${Math.min(task.total, task.total - task.remaining)}/${task.total}` : 'Arbeit …';
  if (task.step === 'RETURN') return 'Werkzeug zurückbringen …';
  return 'Wartet.';
}

export function queueView(world: WorldState): readonly ActionTaskView[] {
  return world.actionQueue.tasks.map((task) => ({
    id: task.id,
    kind: task.kind,
    status: task.status,
    step: task.step,
    label: labelOf(task),
    detail: detailOf(task),
    progress: task.total > 0 ? Math.max(0, Math.min(1, (task.total - task.remaining) / task.total)) : 0,
  }));
}

export function hasMop(world: WorldState): boolean {
  return world.player.carrying.startsWith('MOP:');
}

export function arrived(world: WorldState): boolean {
  return world.player.path.length === 0 || world.player.pathIndex >= world.player.path.length;
}
