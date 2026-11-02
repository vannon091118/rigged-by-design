/** @test-target: src/core/sim/guest-service.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { payAndLeave } from '../guest-service';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  const guest = spawnGuest(world, prng, ledger)!;
  return { world, ledger, guest };
}

describe('Bediente Gäste', () => {
  it('zählt keinen Gast ohne einen einzigen Spin', () => {
    const { world, ledger, guest } = setup();
    guest.spins = 0;
    payAndLeave(world, ledger, guest);
    expect(world.guestsServed).toBe(0);
  });

  it('zählt einen Gast mit gespielten Spins', () => {
    const { world, ledger, guest } = setup();
    guest.spins = 3;
    payAndLeave(world, ledger, guest);
    expect(world.guestsServed).toBe(1);
  });
});
