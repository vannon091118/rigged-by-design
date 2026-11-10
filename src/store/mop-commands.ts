/** Wischer-Commands getrennt vom uebrigen Venue-Modul. */
import type { Ledger } from '../core/economy/ledger';
import { INTERACTION_RADII, isInRange, planInteraction } from '../core/sim/interaction';
import { consumeMopUse, dropMop, pickupMop, spawnMop } from '../core/sim/mop';
import { removeStain } from '../core/sim/stain';
import type { WorldState } from '../core/sim/types';

export function pickupMopCmd(world: WorldState, mopId: number): string {
  const mop = world.mops.find((m) => m.id === mopId);
  if (!mop) throw new Error('Wischer nicht gefunden.');
  if (!isInRange(world.player.position, { x: mop.x, y: mop.y }, INTERACTION_RADII.MOP)) {
    throw new Error('Zu weit weg. Geh erst zum Wischer.');
  }
  pickupMop(world, mopId);
  return world.lastEvent;
}

export function dropMopCmd(world: WorldState): string {
  dropMop(world);
  return world.lastEvent;
}

export function cleanStainCmd(world: WorldState, ledger: Ledger, stainId: number): string {
  const stain = world.stains.find((s) => s.id === stainId);
  if (!stain) throw new Error('Fleck nicht gefunden.');
  if (!isInRange(world.player.position, { x: stain.x, y: stain.y }, INTERACTION_RADII.STAIN)) {
    throw new Error('Zu weit weg. Geh erst zum Fleck.');
  }
  if (!/^MOP:(\d+)$/.exec(world.player.carrying ?? '')) throw new Error('Du brauchst einen Wischer.');
  removeStain(world, ledger, stainId);
  consumeMopUse(world);
  return world.lastEvent;
}

export function getMopAtToiletCmd(world: WorldState, toiletId?: number): string {
  const toilet = toiletId === undefined
    ? world.furniture.find((item) => item.kind === 'TOILET')
    : world.furniture.find((item) => item.id === toiletId && item.kind === 'TOILET');
  if (!toilet) throw new Error('Keine Toilette im Haus.');
  if (!planInteraction(world, { kind: 'furniture', id: toilet.id }).inRange) {
    throw new Error('Zu weit weg. Geh erst zur Toilette.');
  }
  if (world.player.carrying.startsWith('MOP:')) throw new Error('Du traegst bereits einen Wischer.');
  const existing = world.mops.find((mop) => mop.carriedBy === null);
  if (existing) {
    if (!isInRange(world.player.position, { x: existing.x, y: existing.y }, INTERACTION_RADII.MOP)) {
      throw new Error('Der Wischer liegt woanders. Geh erst dorthin.');
    }
    pickupMop(world, existing.id);
    return 'Wischer aufgenommen.';
  }
  const pos = { x: toilet.x, y: toilet.y };
  spawnMop(world, pos.x + 1, pos.y);
  const spawned = world.mops[world.mops.length - 1];
  if (spawned) pickupMop(world, spawned.id);
  return 'Wischer aufgenommen.';
}
