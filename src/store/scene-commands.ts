/** Szenenwechsel: Wohnung, Stadt, eigenes Casino und zurueck; kein zweiter Spielzustand. */
import type { WorldState } from '../core/sim/types';
import { travel } from '../core/sim/city';
import { cityDoorEffect } from '../core/sim/city-doors';
import { CITY_SPAWN } from '../core/sim/city-scene';
import { playerApartmentModel } from '../core/sim/player-apartment';
import { clearActionQueue } from '../core/sim/action-queue';
import { ensureCityPopulationForScene } from '../core/sim/city-life-state';
import { CityDoorWalk } from './city-door-walk';
import { enterInterior, leaveInterior, leaveInteriorAtDoor } from './interior-commands';

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
  readonly #doors: CityDoorWalk;

  constructor(deps: Deps) {
    this.#deps = deps;
    this.#doors = new CityDoorWalk({
      world: deps.world, notice: deps.notice, emit: deps.emit,
      enter: (doorId) => { this.enterStreetDoor(doorId); },
    });
  }

  /** Die Haustuer: aus der Wohnung auf die Strasse (und aus dem Casino in die Stadt). */
  enterCity(): void {
    this.#doors.clear();
    const world = this.#deps.world();
    if (world.scene.kind === 'INTERIOR') { this.leaveInterior(); return; }
    if (world.scene.kind === 'CITY') {
      // Ein geladener CITY-Save kann noch die kuratierte Dreierbesetzung
      // tragen. Der Weg in die Stadt ist auch dann der Wachstumspfad.
      ensureCityPopulationForScene(world);
      return;
    }
    const fromCasino = world.scene.kind === 'OWN';
    clearActionQueue(world);
    // Nur der Weg aus dem Casino merkt sich die Rueckkehrposition; die Wohnung
    // hat ihren festen Platz am Flur, nicht die Koordinaten des Casinos.
    if (fromCasino) world.sceneReturnPosition = { ...world.player.position };
    world.activeForeignFloorId = null;
    world.scene = { kind: 'CITY' };
    // Die Strasse ist keine Dreierbuehne: Beim ersten Schritt vor die Tuer
    // waechst die Bewohnerschaft, jeder Neue bekommt Profil und Schicht.
    ensureCityPopulationForScene(world);
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
    this.#doors.clear();
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
  enterStreetDoor(doorId: string): 'APARTMENT' | 'CASINO' | 'CITY' | 'INTERIOR' | null {
    const effect = cityDoorEffect(doorId);
    const ownDoor = effect === null && this.#isOwnDoor(doorId);
    if (!effect && !ownDoor) return null;
    // Eine Tuer ist ein Ort, kein Menuepunkt: Ohne Nahe zur Schwelle schickt der
    // Klick den Spieler erst hin; der Uebergang laeuft bei Ankunft (#506).
    if (!this.#doors.atDoor(doorId)) {
      this.#doors.request(doorId);
      return null;
    }
    if (!effect) {
      // Das eigene Casino traegt seine Tuer aus dem Layout (`door-<zone>`), nicht
      // aus der Strassentabelle. Ohne diesen Zweig ginge es nach dem Onboarding
      // nur ueber einen Reload wieder auf die Strasse.
      this.enterCity();
      return 'CITY';
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
    // Kneipe und Laden haben einen echten Innenraum; der Stadtort bleibt als
    // Zustand erhalten, der Raum ist die sichtbare Projektion dieses Wechsels.
    const layoutId = effect.location === 'KIEZ' ? 'layout_kiez_pub' : 'layout_corner_shop';
    if (this.enterInterior(layoutId)) return 'INTERIOR';
    this.#deps.notice(world.lastEvent);
    this.#deps.emit();
    return 'CITY';
  }

  /** Betritt einen definierten Innenraum; ohne Layout bleibt der Wechsel aus. */
  enterInterior(layoutId: string): boolean {
    this.#doors.clear();
    return enterInterior({ world: this.#deps.world, say: (text) => this.#say(text) }, layoutId);
  }

  /** Zurück auf die Straße: dieselbe Schwelle, über die der Raum betreten wurde. */
  leaveInterior(): void {
    this.#doors.clear();
    leaveInterior({ world: this.#deps.world, say: (text) => this.#say(text) });
  }

  /** Die Innenraumtür als Ort: true, wenn ihre Kachel erreicht ist. */
  leaveInteriorAtDoor(): boolean {
    return leaveInteriorAtDoor({ world: this.#deps.world, say: (text) => this.#say(text) });
  }

  /** Ist die Tuer die eigene Haustuer des Casinos? */
  #isOwnDoor(doorId: string): boolean {
    const world = this.#deps.world();
    if (world.scene.kind !== 'OWN') return false;
    return world.layout.edges.some((edge) => edge.kind === 'DOOR' && edge.id === doorId);
  }

  /** Ankunft am gemerkten Tuerziel: erst hier oeffnet sich die Tuer (#506). */
  arriveAtStreetDoor(): boolean {
    return this.#doors.arrive();
  }

  /** Die Eroeffnung schliessen: der einzige Weg von OPENING in die Wohnung. */
  finishOpening(): void {
    const world = this.#deps.world();
    if (world.onboarding?.step !== 'OPENING') return;
    world.onboarding = { step: 'APARTMENT' };
    this.#say('Du wachst in deiner Wohnung auf. Die Haustür führt auf die Straße.');
  }

  enterCasino(): void {
    this.#doors.clear();
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
