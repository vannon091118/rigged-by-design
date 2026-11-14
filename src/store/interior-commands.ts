/** Szenenwechsel in und aus Stadt-Innenräumen; ein Zustand, keine Kopie der Stadt. */
import type { WorldState } from '../core/sim/types';
import { clearActionQueue } from '../core/sim/action-queue';
import { interiorDef, type InteriorDef } from '../core/sim/interior-layouts';

interface InteriorDeps {
  readonly world: () => WorldState;
  readonly say: (text: string) => void;
}

function roomOf(world: WorldState): InteriorDef | null {
  return world.scene.kind === 'INTERIOR' ? interiorDef(world.scene.interior?.layoutId) : null;
}

/** Betritt einen definierten Innenraum; ohne Layout bleibt der Wechsel aus. */
export function enterInterior(deps: InteriorDeps, layoutId: string): boolean {
  const room = interiorDef(layoutId);
  if (!room) return false;
  const world = deps.world();
  clearActionQueue(world);
  world.activeForeignFloorId = null;
  world.scene = { kind: 'INTERIOR', interior: { buildingId: room.buildingId, layoutId: room.layoutId, name: room.name } };
  world.player.position = { ...room.spawn };
  world.player.path = [];
  world.player.pathIndex = 0;
  deps.say(room.kind === 'PUB' ? 'Du stehst in der Kiezkneipe.' : 'Du stehst im Späti.');
  return true;
}

/** Zurück auf die Straße: dieselbe Schwelle, über die der Raum betreten wurde. */
export function leaveInterior(deps: InteriorDeps): void {
  const world = deps.world();
  const room = roomOf(world);
  if (!room) return;
  clearActionQueue(world);
  world.scene = { kind: 'CITY' };
  world.player.position = { ...room.streetDoor };
  world.player.path = [];
  world.player.pathIndex = 0;
  deps.say('Du trittst zurück auf die Straße.');
}

/** Die Innenraumtür als Ort: true, wenn ihre Kachel erreicht ist. */
export function leaveInteriorAtDoor(deps: InteriorDeps): boolean {
  const world = deps.world();
  const room = roomOf(world);
  if (!room) return false;
  const pos = world.player.position;
  if (pos.x !== room.exitTile.x || pos.y !== room.exitTile.y) return false;
  leaveInterior(deps);
  return true;
}
