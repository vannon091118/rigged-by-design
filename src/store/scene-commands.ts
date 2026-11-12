/** Szenenwechsel: Wohnung, Stadt, eigenes Casino und zurueck; kein zweiter Spielzustand. */
import type { WorldState } from '../core/sim/types';
import { CITY_SPAWN } from '../core/sim/city-scene';
import { playerApartmentModel } from '../core/sim/player-apartment';

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

  /** Die Haustuer: aus der Wohnung auf die Strasse (und aus dem Casino in die Stadt). */
  enterCity(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'CITY') return;
    // Nur der Weg aus dem Casino merkt sich die Rueckkehrposition; die Wohnung
    // hat ihren festen Platz am Flur, nicht die Koordinaten des Casinos.
    if (world.scene.kind === 'OWN') world.sceneReturnPosition = { ...world.player.position };
    world.activeForeignFloorId = null;
    world.scene = { kind: 'CITY' };
    world.player.position = { ...CITY_SPAWN };
    world.player.path = [];
    world.player.pathIndex = 0;
    if (world.onboarding?.step === 'APARTMENT') world.onboarding = { step: 'CITY' };
    this.#say('Du trittst aus der Haustür auf die Straße.');
  }

  /** Zurueck durch die Haustuer: die Wohnung bleibt derselbe Spielzustand. */
  enterApartment(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'APARTMENT') return;
    world.activeForeignFloorId = null;
    world.scene = { kind: 'APARTMENT' };
    // Zurueck zu Hause zeigt wieder den Wohnungsschritt; erst der naechste
    // Weg nach draussen macht daraus Stadt oder Casino.
    if (world.onboarding && world.onboarding.step !== 'DONE' && world.onboarding.step !== 'OPENING') {
      world.onboarding = { step: 'APARTMENT' };
    }
    // Eine Kachel vor der Haustuer: wer auf der Schwelle steht, tritt sonst sofort wieder hinaus.
    const door = playerApartmentModel().exitDoor;
    world.player.position = { x: door.x, y: Math.max(0, door.y - 1) };
    world.player.path = [];
    world.player.pathIndex = 0;
    this.#say('Du bist zu Hause. Die Haustür führt auf die Straße.');
  }

  /** Die Haustuer als Ort: true, wenn ihre Kachel erreicht ist und der Wechsel lief. */
  leaveApartmentAtDoor(): boolean {
    const world = this.#deps.world();
    if (world.scene.kind !== 'APARTMENT') return false;
    const door = playerApartmentModel().exitDoor;
    const pos = world.player.position;
    if (pos.x !== door.x || pos.y !== door.y) return false;
    this.enterCity();
    return true;
  }

  /** Die Eroeffnung schliessen: der einzige Weg von OPENING in die Wohnung. */
  finishOpening(): void {
    const world = this.#deps.world();
    if (world.onboarding?.step !== 'OPENING') return;
    world.onboarding = { step: 'APARTMENT' };
    this.#say('Du wachst in deiner Wohnung auf. Die Haustür führt auf die Straße.');
  }

  enterCasino(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'OWN') return;
    world.activeForeignFloorId = null;
    world.scene = { kind: 'OWN' };
    if (world.sceneReturnPosition) world.player.position = { ...world.sceneReturnPosition };
    world.player.path = [];
    world.player.pathIndex = 0;
    if (world.onboarding?.step === 'OPENING' || world.onboarding?.step === 'CITY') world.onboarding = { step: 'CASINO' };
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
