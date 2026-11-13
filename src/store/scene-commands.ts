/** Szenenwechsel: Wohnung, Stadt, eigenes Casino und zurueck; kein zweiter Spielzustand. */
import type { WorldState } from '../core/sim/types';
import { travel } from '../core/sim/city';
import { cityDoorEffect } from '../core/sim/city-doors';
import { CITY_SPAWN } from '../core/sim/city-scene';
import { playerApartmentModel } from '../core/sim/player-apartment';
import { clearActionQueue } from '../core/sim/action-queue';
import { ensureCityPopulation } from '../core/sim/city-life-state';
import { CITY_POPULATION_STREET } from '../core/sim/city-npc-roster';

interface Deps {
  readonly world: () => WorldState;
  readonly emit: () => void;
  readonly notice: (text: string) => void;
}

/**
 * Austritt aus dem eigenen Haus: eine Kachel vor der Grand-Schwelle
 * (`door_street_to_casino_grand`, x=22, y=22). Wer aus dem Casino kommt, steht
 * dort und nicht am Wohnungseingang.
 */
const CASINO_STREET_SPAWN = Object.freeze({ x: 22, y: 23 });

export class SceneCommands {
  readonly #deps: Deps;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  /** Die Haustuer: aus der Wohnung auf die Strasse (und aus dem Casino in die Stadt). */
  enterCity(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'CITY') return;
    const fromCasino = world.scene.kind === 'OWN';
    clearActionQueue(world);
    // Nur der Weg aus dem Casino merkt sich die Rueckkehrposition; die Wohnung
    // hat ihren festen Platz am Flur, nicht die Koordinaten des Casinos.
    if (fromCasino) world.sceneReturnPosition = { ...world.player.position };
    world.activeForeignFloorId = null;
    world.scene = { kind: 'CITY' };
    // Die Strasse ist keine Dreierbuehne: Beim ersten Schritt vor die Tuer
    // waechst die Bewohnerschaft, jeder Neue bekommt Profil und Schicht.
    ensureCityPopulation(world, CITY_POPULATION_STREET);
    // Kein Teleport: Der Casino-Austritt landet an der eigenen Schwelle, der
    // Wohnungsaustritt am Wohnungseingang.
    world.player.position = { ...(fromCasino ? CASINO_STREET_SPAWN : CITY_SPAWN) };
    world.player.path = [];
    world.player.pathIndex = 0;
    if (world.onboarding?.step === 'APARTMENT') world.onboarding = { step: 'CITY' };
    this.#say('Du trittst aus der Haustür auf die Straße.');
  }

  /** Zurueck durch die Haustuer: die Wohnung bleibt derselbe Spielzustand. */
  enterApartment(): void {
    const world = this.#deps.world();
    if (world.scene.kind === 'APARTMENT') return;
    clearActionQueue(world);
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

  /**
   * Die vier Strassentueren. Wohnung und Casino wechseln die Szene, Kiez und
   * Markt reisen in den bestehenden Stadtort; `null` heisst ohne Wirkung.
   */
  enterStreetDoor(doorId: string): 'APARTMENT' | 'CASINO' | 'CITY' | null {
    const effect = cityDoorEffect(doorId);
    if (!effect) {
      // Das eigene Casino traegt seine Tuer aus dem Layout (`door-<zone>`), nicht
      // aus der Strassentabelle. Ohne diesen Zweig ginge es nach dem Onboarding
      // nur ueber einen Reload wieder auf die Strasse.
      if (this.#isOwnDoor(doorId)) { this.enterCity(); return 'CITY'; }
      return null;
    }
    if (effect.kind === 'APARTMENT') { this.enterApartment(); return 'APARTMENT'; }
    if (effect.kind === 'CASINO') { this.enterCasino(); return 'CASINO'; }
    const world = this.#deps.world();
    try {
      travel(world, effect.location);
      clearActionQueue(world);
    } catch (error) {
      this.#deps.notice(error instanceof Error ? error.message : 'Diese Tür ist verschlossen.');
      this.#deps.emit();
      return null;
    }
    this.#deps.notice(world.lastEvent);
    this.#deps.emit();
    return 'CITY';
  }

  /** Ist die Tuer die eigene Haustuer des Casinos? */
  #isOwnDoor(doorId: string): boolean {
    const world = this.#deps.world();
    if (world.scene.kind !== 'OWN') return false;
    return world.layout.edges.some((edge) => edge.kind === 'DOOR' && edge.id === doorId);
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
    clearActionQueue(world);
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
