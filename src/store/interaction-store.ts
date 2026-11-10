/** Zielfokus des Stores: planen, laufen lassen, abbrechen. Haelt keinen zweiten Zustand. */
import {
  approachTarget, planInteraction, stopPlayer,
  type InteractionPlan, type InteractionTarget,
} from '../core/sim/interaction';
import { nearestTarget } from '../core/sim/interaction-nearest';
import type { Point, WorldState } from '../core/sim/types';

interface Deps {
  readonly world: () => WorldState;
  readonly emit: (save: boolean) => void;
  readonly notice: (text: string) => void;
}

export class InteractionStore {
  readonly #deps: Deps;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  /** Klick auf ein Ziel: planen, Grund nennen, sonst laufen lassen. */
  approach(target: InteractionTarget): InteractionPlan {
    const world = this.#deps.world();
    const plan = approachTarget(world, target);
    if (!plan.reachable) this.#deps.notice(plan.reason);
    this.#deps.emit(false);
    return plan;
  }

  /** Reichweite ist erst erfuellt, wenn die Figur auf ihrem Standplatz steht. */
  inRange(target: InteractionTarget): boolean {
    return planInteraction(this.#deps.world(), target).inRange;
  }

  nearest(maxDistance = 4): InteractionTarget | null {
    const world = this.#deps.world();
    return nearestTarget(world, this.position(), maxDistance);
  }

  /** Auf einem fremden Floor laeuft dieselbe Interaktion mit dessen Spielerstand. */
  private position(): Point {
    const world = this.#deps.world();
    const floor = world.activeForeignFloorId === null
      ? null
      : world.foreignFloors.find((entry) => entry.id === world.activeForeignFloorId) ?? null;
    return floor?.playerPosition ?? world.player.position;
  }

  cancel(): void {
    stopPlayer(this.#deps.world());
    this.#deps.emit(false);
  }

  notify(text: string): void {
    this.#deps.notice(text);
    this.#deps.emit(false);
  }
}
