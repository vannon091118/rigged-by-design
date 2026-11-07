/** Wischer-System. Headless, deterministisch, keine Browser-Abhängigkeiten. */
import type { WorldState } from './types';

export interface Mop {
  readonly id: number;
  x: number;
  y: number;
  carriedBy: null | 'player';
  usesLeft: number;
}

export function spawnMop(world: WorldState, x: number, y: number): void {
  const mop: Mop = {
    id: world.nextMopId++,
    x, y,
    carriedBy: null,
    usesLeft: 5,
  };
  world.mops.push(mop);
  world.lastEvent = 'Wischer bereitgestellt.';
}

export function pickupMop(world: WorldState, mopId: number): void {
  const mop = world.mops.find((m) => m.id === mopId);
  if (!mop) throw new Error('Wischer nicht gefunden.');
  if (mop.carriedBy !== null) throw new Error('Wischer wird bereits getragen.');
  if (world.player.carrying !== '') throw new Error('Deine Hände sind voll.');
  mop.carriedBy = 'player';
  world.player.carrying = `MOP:${mopId}`;
  world.lastEvent = 'Wischer aufgenommen.';
}

export function dropMop(world: WorldState): void {
  const match = /^MOP:(\d+)$/.exec(world.player.carrying);
  if (!match) throw new Error('Du trägst keinen Wischer.');
  const mopId = Number(match[1]);
  const mop = world.mops.find((m) => m.id === mopId);
  if (!mop) throw new Error('Wischer nicht gefunden.');
  mop.carriedBy = null;
  mop.x = world.player.position.x;
  mop.y = world.player.position.y;
  world.player.carrying = '';
  world.lastEvent = 'Wischer abgelegt.';
}

export function consumeMopUse(world: WorldState): void {
  const match = /^MOP:(\d+)$/.exec(world.player.carrying);
  if (!match) return;
  const mop = world.mops.find((m) => m.id === Number(match[1]));
  if (!mop) return;
  mop.usesLeft -= 1;
  if (mop.usesLeft <= 0) {
    world.mops = world.mops.filter((m) => m.id !== mop.id);
    world.player.carrying = '';
    world.lastEvent = 'Wischer verbraucht.';
  }
}
