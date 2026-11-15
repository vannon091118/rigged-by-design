import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { guestAccount } from '../money';
import { tickWorld } from '../tick';
import { exchangePoint } from '../world';
import { randomSeed } from '../../../test/random-seed';
import { createWorld } from '../templates';
import type { Guest, WorldState } from '../types';

export function setup(template: WorldState['template'] = 'SMALL') {
  const world = createWorld(template);
  const ledger = new Ledger();
  return { world, ledger, prng: new Prng(randomSeed()) };
}

export function moveToExchange(world: WorldState, guest: Guest): void {
  guest.position = { ...exchangePoint(world)! };
  guest.state = 'EXCHANGE';
  guest.queueIndex = 0;
  guest.stateTicks = 1;
  guest.path = [];
}

export function tickUntilExchange(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest): void {
  for (let step = 0; step < 10 && ledger.getBalance(guestAccount(guest.id)) === 0; step += 1) {
    tickWorld(world, ledger, prng);
  }
}

export function tickMany(world: WorldState, ledger: Ledger, prng: Prng, ticks: number): void {
  for (let step = 0; step < ticks; step += 1) tickWorld(world, ledger, prng);
}
