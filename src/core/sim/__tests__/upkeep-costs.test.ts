/** @test-target: src/core/sim/upkeep.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { TICKS_PER_DAY } from '../clock';
import { HAUSKONTO } from '../money';
import { createWorld } from '../templates';
import { staffTick } from '../upkeep';
import { dailyHousingCost } from '../upkeep-costs';

describe('Tagesmiete als eine Quelle', () => {
  it('bucht genau den Betrag, den das HUD als Miete ausweist', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger({ HAUSKONTO: fromVC(100) });
    world.tick = TICKS_PER_DAY;
    const before = ledger.getBalance(HAUSKONTO);

    staffTick(world, ledger, new Prng(randomSeed()));

    expect(before - ledger.getBalance(HAUSKONTO)).toBe(dailyHousingCost(world.prices));
  });

  it('folgt einem geaenderten Reinigungssatz ohne zweite Konstante', () => {
    const world = createWorld('SMALL');
    world.prices.cleaningCost = fromVC(2);
    expect(dailyHousingCost(world.prices)).toBe(fromVC(4));
  });
});
