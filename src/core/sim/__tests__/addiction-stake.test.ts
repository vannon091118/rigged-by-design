/** @test-target: src/core/sim/guest-play.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { addictedStake, sessionSpins } from '../guest-play';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import type { Furniture } from '../types';

function setup(addiction: number) {
  const world = createWorld('SMALL');
  const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
  guest.addiction = addiction;
  const item = world.furniture.find((entry) => entry.gameId === 'SLOT')!;
  const staked: Furniture = { ...item, baseBet: fromVC(1) };
  return addictedStake(world, staked, guest);
}

describe('Sucht steuert Einsatz und Sitzung', () => {
  it('setzt ohne Sucht den Grundbetrag', () => {
    expect(setup(0)).toBe(fromVC(1));
  });

  it('erhöht den Einsatz mit voller Sucht um die Hälfte', () => {
    expect(setup(100)).toBe(fromVC(1.5));
  });

  it('spielt ohne Sucht vier Spins', () => {
    expect(sessionSpins(0)).toBe(4);
  });

  it('spielt mit voller Sucht neun Spins', () => {
    expect(sessionSpins(100)).toBe(9);
  });
});
