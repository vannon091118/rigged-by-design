/** @test-target: src/core/sim/actions.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { installMod, upgradeReels } from '../actions';
import { createWorld } from '../templates';

describe('Gerätegrenzen zwischen Slot und Plinko', () => {
  it('Walzen-Upgrade und vierte Walze gelten nur für Slots', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger({ HAUSKONTO: fromVC(50) });
    const slot = world.furniture.find((item) => item.gameId === 'SLOT')!;
    const plinko = { ...slot, id: 9_001, gameId: 'PLINKO' as const, mods: [] };
    world.furniture.push(plinko);

    expect(() => upgradeReels(world, ledger, plinko.id)).toThrow();
    expect(() => installMod(world, ledger, plinko.id, 'EXTRA_REEL')).toThrow();
    expect(plinko.reels).toBe(slot.reels);
    expect(plinko.mods).toHaveLength(0);

    upgradeReels(world, ledger, slot.id);
    expect(slot.reels).toBe(plinko.reels + 1);
  });
});
