/** @test-target: src/core/sim/deliveries.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { buyCrate, deployCrate, takeCrate } from '../deliveries';
import { HAUSKONTO } from '../money';
import { getBuildDef } from '../offers';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import type { WorldState } from '../types';
import { randomSeed } from '../../../test/random-seed';

function setup(template: WorldState['template'] = 'SMALL') {
  const world = createWorld(template);
  const ledger = new Ledger();
  return { world, ledger, prng: new Prng(randomSeed()) };
}

describe('Lieferkette', () => {
  it('kauft als Kiste und stellt erst nach dem Aufstellen auf', () => {
    const { world, ledger } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'startguthaben fuer test', 0);
    const before = ledger.getBalance(HAUSKONTO);
    const crate = buyCrate(world, ledger, 'PLANT');
    expect(world.furniture).toHaveLength(7);
    expect(world.crates).toHaveLength(1);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - getBuildDef('PLANT').cost);
    expect(deployCrate(world, takeCrate(world, crate.id).id, 20, 12).kind).toBe('DECOR');
    expect(world.furniture).toHaveLength(8);
    expect(world.crates).toHaveLength(0);
    takeCrate(world, buyCrate(world, ledger, 'PLANT').id);
    const blocked = world.crates[world.crates.length - 1]!;
    expect(() => deployCrate(world, blocked.id, 20, 12)).toThrow();
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bucht den Kauf sauber ueber das Ledger und legt die Kiste ins Lager', () => {
    const { world, ledger } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'startguthaben', 0);
    const before = ledger.getBalance(HAUSKONTO);
    buyCrate(world, ledger, 'SLOT');
    expect(ledger.getBalance(HAUSKONTO)).toBeLessThan(before);
    expect(world.crates).toHaveLength(1);
    expect(world.crates[0]!.payload.kind).toBe('FURNITURE');
    expect(world.crates[0]!.carriedBy).toBe(null);
    expect(world.furniture).toHaveLength(7);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('eine getragene Kiste kann nicht zweimal aufgestellt werden', () => {
    const { world, ledger } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'startguthaben', 0);
    const crate = buyCrate(world, ledger, 'PLANT');
    const carried = takeCrate(world, crate.id);
    expect(carried.carriedBy).toBe('player');
    const spot = { x: 20, y: 12 };
    deployCrate(world, carried.id, spot.x, spot.y);
    expect(world.furniture.some((item) => item.x === spot.x && item.y === spot.y)).toBe(true);
    expect(world.crates).toHaveLength(0);
    const guest = spawnGuest(world, new Prng(randomSeed()), ledger);
    expect(guest).not.toBeNull();
  });
});
