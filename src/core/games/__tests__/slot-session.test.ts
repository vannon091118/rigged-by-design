/**
 * @test-target: src/core/games/slot-session.ts
 * @error-code: ERR-1003
 *
 * Eine Auszahlung, die der Deckungspuffer kuerzt, darf nicht mit dem
 * Engine-Wunsch beschriftet werden. Der Drucklader verbucht dagegen den
 * tatsaechlich gespielten Multiplikator inklusive Bonus.
 */
import { describe, expect, it } from 'vitest';
import { fromVC, mulVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { getBuildDef } from '../../sim/offers';
import type { Furniture } from '../../sim/types';
import { createSlotMemory } from '../slot-transparency';
import { playSlot } from '../engines/slot';
import { playSlotSession } from '../slot-session';

function machine(): Furniture {
  const def = getBuildDef('SLOT');
  return {
    id: 1, kind: 'SLOT', gameId: 'SLOT', x: 0, y: 0, w: def.w, h: def.h, seats: def.seats,
    label: def.name, price: fromVC(0), quality: def.quality, condition: 100, damaged: false, dirt: 0,
    stock: 0, clog: 0, clogged: false, zoneId: 'gaming', occupants: [], mods: [], reels: 3,
    baseBet: def.baseBet,
  };
}

function winningSeed(minBps: number): { seed: number; bps: number } {
  for (let seed = 1; seed < 10_000; seed += 1) {
    const outcome = playSlot(new Prng(seed), { reels: 3 });
    if (!outcome.jackpot && outcome.multiplierBps >= minBps) return { seed, bps: outcome.multiplierBps };
  }
  throw new Error('Kein passender Gewinn-Seed gefunden.');
}

describe('Slot-Session-Wahrheit', () => {
  it('nennt bei einer Kuerzung den tatsaechlich gezahlten Multiplikator', () => {
    const { seed, bps } = winningSeed(10_000);
    const bet = fromVC(1);
    const item = machine();
    item.slotMemory = { ...createSlotMemory(3), bank: -fromVC(1.5) };
    const result = playSlotSession(item, new Prng(seed), bet);
    const raw = mulVC(bet, bps);
    const payout = Math.max(0, raw - fromVC(0.5));
    const paidBps = Math.round((payout / bet) * 10_000);
    expect(result.payout).toBe(payout);
    expect(result.multiplierBps).toBe(bps);
    expect(result.label).toBe(`${(paidBps / 10_000).toFixed(2).replace('.', ',')}x`);
    expect(result.label).not.toContain('ENTLADUNG');
  });

  it('verbucht den Bonus im Drucklader-Multiplikator', () => {
    const { seed, bps } = winningSeed(1);
    const item = machine();
    const memory = item.slotMemory = { ...createSlotMemory(3), pressureLevel: 3 };
    const result = playSlotSession(item, new Prng(seed), fromVC(1), 10_000);
    expect(result.multiplierBps).toBe(bps + 10_000);
    expect(memory.pressureLevel).toBe(0);
    expect(memory.chargeReady).toBe(false);
  });
});
