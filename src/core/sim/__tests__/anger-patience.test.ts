/** @test-target: src/core/sim/upkeep.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { decay } from '../upkeep';

function guestWith(patience: number, mood: number) {
  const world = createWorld('SMALL');
  const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
  guest.state = 'CHOOSE';
  guest.patience = patience;
  guest.mood = mood;
  decay(world);
  return guest;
}

describe('Wut folgt der Geduld', () => {
  it('wird wütend, wenn die Geduld aufgebraucht ist', () => {
    expect(guestWith(0, 60).state).toBe('ANGRY');
  });

  it('bleibt ruhig, wenn nur die Laune schlecht ist', () => {
    expect(guestWith(60, 5).state).not.toBe('ANGRY');
  });
});
