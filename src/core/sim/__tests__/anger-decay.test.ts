/** @test-target: src/core/sim/upkeep.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { decay } from '../upkeep';

describe('Wut klingt ab', () => {
  it('senkt die Wut eines geschlichteten Gastes', () => {
    const world = createWorld('SMALL');
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    guest.state = 'CHOOSE';
    guest.mood = 80;
    guest.anger = 100;
    decay(world);
    expect(guest.anger).toBeLessThan(100);
  });

  it('lässt die Wut während des Randalierens unangetastet', () => {
    const world = createWorld('SMALL');
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    guest.state = 'ANGRY';
    guest.anger = 100;
    decay(world);
    expect(guest.anger).toBe(100);
  });
});
