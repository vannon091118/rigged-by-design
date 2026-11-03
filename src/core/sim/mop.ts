/**
 * Wischer-System.
 * Headless, deterministisch, keine Browser-Abhängigkeiten.
 * Ein Wischer hält 5 Reinigungen (MOP_USES) und wird danach verbraucht.
 */

import type { WorldState } from './types';

export const MOP_USES = 5;

export interface Mop {
  readonly id: number;
  x: number;
  y: number;
  carriedBy: null | 'player';
  usesLeft: number;
}

/**
 * Erzeugt einen neuen Wischer an der angegebenen Position.
 */
export function spawnMop(world: WorldState, x: number, y: number): void {
  const mop: Mop = {
    id: world.nextMopId++,
    x, y,
    carriedBy: null,
    usesLeft: MOP_USES,
  };
  world.mops.push(mop);
  world.lastEvent = 'Wischer bereitgestellt.';
}

/**
 * Nimmt einen Wischer auf. Der Spieler darf nichts anderes tragen.
 */
export function pickupMop(world: WorldState, mopId: number): void {
  const mop = world.mops.find((m) => m.id === mopId);
  if (!mop) throw new Error('Wischer nicht gefunden.');
  if (mop.carriedBy !== null) throw new Error('Wischer wird bereits getragen.');
  if (world.player.carrying !== '') throw new Error('Deine Hände sind voll.');
  mop.carriedBy = 'player';
  world.player.carrying = `MOP:${mopId}`;
  world.lastEvent = 'Wischer aufgenommen.';
}

/**
 * Legt den getragenen Wischer am Spielerstandort ab.
 */
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

/**
 * Verbraucht eine Nutzung des getragenen Wischers.
 * Bei 0 verbleibenden Nutzungen wird der Wischer zerstört.
 */
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
