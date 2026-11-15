/** Foreign Floor Commands: Besucher- und Job-Aktionen in fremden Casinos. */

import { acceptJob, quitJob, requestJobTask, buyBar } from '../core/sim/player-jobs';
import { getOrCreateForeignFloor } from '../core/sim/foreign-floor-tick';
import { getRival, type RivalId } from '../core/sim/rivals';
import { BLUEPRINTS } from '../core/sim/house-presets';
import { layoutFromTemplate, zonesFromLayout } from '../core/sim/layout-derive';
import { nearestWalkable } from '../core/sim/pathfinding';
import { worldNav } from '../core/sim/world';
import type { TemplateId, WorldState } from '../core/sim/types';
import type { Ledger } from '../core/economy/ledger';
import { clearActionQueue } from '../core/sim/action-queue';

export function acceptJobCmd(world: WorldState, rivalId: RivalId, jobId: import('../core/sim/types').PlayerJobId): void {
  acceptJob(world, rivalId, jobId);
}

export function quitJobCmd(world: WorldState): void {
  quitJob(world);
}

export function requestJobTaskCmd(world: WorldState): { started: boolean; queuePosition: number } {
  return requestJobTask(world);
}

export function buyBarCmd(world: WorldState, ledger: Ledger, tick: number): void {
  buyBar(world, ledger, tick);
}

export function visitForeignCmd(world: WorldState, rivalId: RivalId): void {
  clearActionQueue(world);
  const rival = getRival(rivalId);
  // Ein fremder Floor ist ein echter Raum, kein HUD-Eintrag: eigener Plan,
  // eigene Moebel und ein eigener Spielerstand.
  const template: TemplateId = rival.size >= 90 ? 'LARGE' : rival.size >= 60 ? 'MEDIUM' : 'SMALL';
  const layout = layoutFromTemplate(template);
  const blueprint = BLUEPRINTS[template];
  const furniture = blueprint.furniture().map((item, index) => ({ ...item, id: 10_000 + index }));
  const floor = getOrCreateForeignFloor(world, rivalId, rival.size, zonesFromLayout(layout), furniture, rival.jobStations);
  floor.layout = layout;
  floor.template = template;
  floor.zones = zonesFromLayout(layout);
  floor.furniture = furniture;
  floor.guests = [];
  world.activeForeignFloorId = floor.id;
  world.scene = { kind: 'FOREIGN', foreignFloorId: floor.id };
  // Der Startpunkt liegt auf dem foreign-eigenen Raster, nicht auf dem des
  // eigenen Casinos. Ein alter, inzwischen blockierter Stand wird korrigiert.
  const start = floor.playerPosition ?? { x: 2, y: 2 };
  floor.playerPosition = nearestWalkable(worldNav(world), start) ?? start;
  floor.playerPath = [];
  floor.playerPathIndex = 0;
  world.lastEvent = `Du betrittst ${rival.name}.`;
}

export function leaveForeignCmd(world: WorldState): void {
  if (world.activeForeignFloorId === null) throw new Error('Du bist nicht in einem fremden Casino.');
  clearActionQueue(world);
  world.activeForeignFloorId = null;
  world.scene = { kind: 'OWN' };
  world.lastEvent = 'Du bist zurück in deinem Casino.';
}