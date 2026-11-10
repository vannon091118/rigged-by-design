/** Szenenwechsel: Stadt, eigenes Casino und zurueck; kein zweiter Spielzustand. */
import type { WorldState } from '../core/sim/types';
import { CITY_SPAWN } from '../core/sim/city-scene';

interface Deps {
  readonly world: () => WorldState;
  readonly emit: () => void;
  readonly notice: (text: string) => void;
}

export class SceneCommands {
  readonly #deps: Deps;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  enterCity(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'CITY') return;
    world.sceneReturnPosition = { ...world.player.position };
    world.activeForeignFloorId = null;
    world.scene = { kind: 'CITY' };
    world.player.position = { ...CITY_SPAWN };
    world.player.path = [];
    world.player.pathIndex = 0;
    this.#say('Du bist in der Stadt.');
  }

  enterCasino(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'OWN') return;
    world.activeForeignFloorId = null;
    world.scene = { kind: 'OWN' };
    if (world.sceneReturnPosition) world.player.position = { ...world.sceneReturnPosition };
    world.player.path = [];
    world.player.pathIndex = 0;
    if (world.onboarding?.step === 'CITY') world.onboarding = { step: 'CASINO' };
    this.#say('Dein Casino. Die erste Kiste steht bereit.');
  }

  finishOnboarding(): void {
    this.#deps.world().onboarding = { step: 'DONE' };
    this.#say('Auftrag angenommen. Jetzt zählt der erste Gast.');
  }

  #say(text: string): void {
    const world = this.#deps.world();
    world.lastEvent = text;
    this.#deps.notice(text);
    this.#deps.emit();
  }
}
