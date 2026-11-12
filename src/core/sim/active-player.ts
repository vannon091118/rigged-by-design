/**
 * Der Spieler steht immer auf genau einem Floor. Dieses Modul beantwortet,
 * welcher das ist, ohne einen zweiten Spielerzustand anzulegen: eigener Floor,
 * Wohnung und Stadt lesen `world.player`, ein fremder Floor seinen eigenen
 * Stand. Bewegung, Pfad, Tick und Auftragskette greifen darueber zu.
 */
import type { ForeignFloorState, Point, WorldState } from './types';

/** Der aktive fremde Floor, falls die Szene einen besitzt. */
export function activeForeignFloor(world: WorldState): ForeignFloorState | null {
  if (world.scene.kind !== 'FOREIGN') return null;
  const id = world.scene.foreignFloorId ?? world.activeForeignFloorId;
  if (id === null) return null;
  return world.foreignFloors.find((floor) => floor.id === id) ?? null;
}

/** Die Position der Spielfigur auf dem aktiven Floor. */
export function activePlayerPosition(world: WorldState): Point {
  return activeForeignFloor(world)?.playerPosition ?? world.player.position;
}

/** Der Pfad der Spielfigur auf dem aktiven Floor. */
export function activePlayerPath(world: WorldState): readonly Point[] {
  return activeForeignFloor(world)?.playerPath ?? world.player.path;
}

/** Der bereits abgelaufene Teil des aktiven Pfads. */
export function activePlayerPathIndex(world: WorldState): number {
  return activeForeignFloor(world)?.playerPathIndex ?? world.player.pathIndex;
}

/** Setzt einen neuen Pfad auf dem Floor, auf dem die Figur steht. */
export function setActivePlayerPath(world: WorldState, path: Point[]): void {
  const floor = activeForeignFloor(world);
  if (floor) {
    floor.playerPath = path;
    floor.playerPathIndex = 0;
    return;
  }
  world.player.path = path;
  world.player.pathIndex = 0;
}

/** Haelt die Figur an, ohne den Floor zu wechseln. */
export function stopActivePlayer(world: WorldState): void {
  setActivePlayerPath(world, []);
}

/** Rueckt den aktiven Pfad um die Geschwindigkeitsstufe weiter. */
export function advanceActivePlayer(world: WorldState, steps: number): void {
  const floor = activeForeignFloor(world);
  if (floor) {
    const start = floor.playerPosition ?? world.player.position;
    for (let step = 0; step < steps && floor.playerPathIndex < floor.playerPath.length; step += 1) {
      floor.playerPosition = { ...floor.playerPath[floor.playerPathIndex]! };
      floor.playerPathIndex += 1;
    }
    floor.playerPosition ??= { ...start };
    return;
  }
  for (let step = 0; step < steps && world.player.pathIndex < world.player.path.length; step += 1) {
    world.player.position = { ...world.player.path[world.player.pathIndex]! };
    world.player.pathIndex += 1;
  }
}
