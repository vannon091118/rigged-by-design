/** Queue-Commands: die UI reiht Auftraege ein, der Store bleibt der Eigentuemer. */
import { cancelTask, enqueueTask } from '../core/sim/action-queue';
import type { Point, WorldState } from '../core/sim/types';

interface Deps {
  readonly world: () => WorldState;
  readonly emit: (save?: boolean) => void;
  readonly notice: (text: string) => void;
}

export class QueueCommands {
  readonly #deps: Deps;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  enqueueMove(point: Point): void { this.#run(() => { enqueueTask(this.#deps.world(), { kind: 'MOVE', point }); }); }
  enqueueCleanStain(stainId: number): void { this.#run(() => { enqueueTask(this.#deps.world(), { kind: 'CLEAN_STAIN', target: { kind: 'stain', id: stainId } }); }); }
  enqueueCleanRoom(): void { this.#run(() => { enqueueTask(this.#deps.world(), { kind: 'CLEAN_ROOM' }); }); }
  enqueueGetMop(): void { this.#run(() => { enqueueTask(this.#deps.world(), { kind: 'GET_MOP' }); }); }
  enqueuePickupMop(mopId: number): void { this.#run(() => { enqueueTask(this.#deps.world(), { kind: 'GET_MOP', target: { kind: 'mop', id: mopId } }); }); }
  enqueueReturnMop(): void { this.#run(() => { enqueueTask(this.#deps.world(), { kind: 'RETURN_MOP' }); }); }
  cancel(taskId: string): void { this.#run(() => { if (!cancelTask(this.#deps.world(), taskId)) return; }); }

  #run(action: () => void): void {
    try {
      action();
      this.#deps.notice(this.#deps.world().lastEvent);
      this.#deps.emit();
    } catch (error) {
      this.#deps.notice(error instanceof Error ? error.message : 'Auftrag fehlgeschlagen.');
      this.#deps.emit(false);
    }
  }
}
