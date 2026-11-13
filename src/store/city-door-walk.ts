/** Der Weg zur Stadtschwelle: ein ferner Tuerklick ist ein Auftrag, kein Sprung. */
import type { WorldState } from '../core/sim/types';
import type { LayoutEdge } from '../core/sim/layout-types';
import { findPath, nearestWalkable } from '../core/sim/pathfinding';
import { setActivePlayerPath } from '../core/sim/active-player';
import { worldNav } from '../core/sim/world';

interface Deps {
  readonly world: () => WorldState;
  readonly notice: (text: string) => void;
  readonly emit: () => void;
  /** Wird erst bei Ankunft gerufen; der Aufrufer wechselt dann die Szene. */
  readonly enter: (doorId: string) => void;
}

/**
 * Merkt sich eine angesteuerte Tuer, solange der Spieler laeuft. Der Zustand
 * lebt nur in der Sitzung: Nach einem Reload gibt es keinen halben Auftrag.
 */
export class CityDoorWalk {
  readonly #deps: Deps;
  #pendingDoorId: string | null = null;

  constructor(deps: Deps) {
    this.#deps = deps;
  }

  /** Szenenwechsel und neuer Auftrag raeumen den gemerkten Weg. */
  clear(): void {
    this.#pendingDoorId = null;
  }

  /** Steht der Spieler an der Schwelle? Unbekannte Tueren gelten nicht als nah. */
  atDoor(doorId: string): boolean {
    const door = this.#edge(doorId);
    const pos = this.#deps.world().player.position;
    return door ? Math.max(Math.abs(pos.x - door.x), Math.abs(pos.y - door.y)) <= 1 : false;
  }

  /**
   * Ferner Klick: Der Weg zur Schwelle ist der Auftrag. Findet die Navigation
   * keinen Weg, bleibt es bei der Ablehnung.
   */
  request(doorId: string): boolean {
    const world = this.#deps.world();
    const door = this.#edge(doorId);
    if (!door) return false;
    const nav = worldNav(world);
    const spot = nearestWalkable(nav, { x: door.x, y: door.y });
    if (!spot) return false;
    const path = findPath(nav, world.player.position, spot);
    if (path.length === 0) return false;
    setActivePlayerPath(world, path);
    this.#pendingDoorId = doorId;
    this.#deps.notice('Du gehst zur Tür.');
    this.#deps.emit();
    return true;
  }

  /**
   * Ankunft pruefen: erst am Ziel oeffnet sich die Tuer. Wer den Weg woanders
   * beendet, verliert den Auftrag.
   */
  arrive(): boolean {
    const pending = this.#pendingDoorId;
    if (!pending) return false;
    const world = this.#deps.world();
    if (world.scene.kind === 'APARTMENT') { this.#pendingDoorId = null; return false; }
    if (world.player.pathIndex < world.player.path.length) return false;
    this.#pendingDoorId = null;
    if (!this.atDoor(pending)) return false;
    this.#deps.enter(pending);
    return true;
  }

  #edge(doorId: string): LayoutEdge | undefined {
    const world = this.#deps.world();
    const edges = world.scene.kind === 'CITY'
      ? world.cityScene?.layout.edges ?? []
      : world.layout.edges;
    return edges.find((edge) => edge.kind === 'DOOR' && edge.id === doorId);
  }
}
