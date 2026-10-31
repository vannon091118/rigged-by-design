/**
 * @test-target: src/core/games/slot-session.ts
 * @error-code: ERR-1003
 *
 * Der Pfad, den Gaeste wirklich spielen, muss dem Haus einen Vorteil lassen.
 * Der Drucklader darf keine Auszahlung ueber dem Einbehaltenen erzeugen.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { getBuildDef } from '../../sim/offers';
import type { Furniture } from '../../sim/types';
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

describe('Slot-Session', () => {
  it('zahlt ueber viele Spins weniger aus als eingenommen', { timeout: 120_000 }, () => {
    const prng = new Prng(randomSeed());
    const item = machine();
    const bet = fromVC(0.5);
    const spins = 60_000;
    let stake = 0;
    let payout = 0;
    let discharges = 0;
    for (let index = 0; index < spins; index += 1) {
      const result = playSlotSession(item, prng, bet);
      stake += result.stake;
      payout += result.payout;
      if (result.label.startsWith('ENTLADUNG')) discharges += 1;
    }
    const rtp = payout / stake;
    expect(stake).toBe(spins * bet);
    expect(discharges, 'Entladungen kommen vor').toBeGreaterThan(0);
    // Streuung durch Jackpots: der Vorteil muss klar bleiben, nicht exakt 93 %.
    expect(rtp, 'RTP der Gast-Session').toBeGreaterThan(0.88);
    expect(rtp, 'RTP der Gast-Session').toBeLessThan(1.02);
  });

  it('gibt eine Entladung nur aus einbehaltenem Polster', () => {
    const prng = new Prng(randomSeed());
    const item = machine();
    const bet = fromVC(0.5);
    const memory = item.slotMemory = {
      spinsToday: 0, spinsSinceLastJackpot: 0, averageJackpotInterval: 1000, currentDrift: -1000,
      recentSymbolHistogram: {}, recentSpins: [], pressureLevel: 7, chargeReady: true, bank: 0,
    };
    const result = playSlotSession(item, prng, bet);
    expect(result.label.startsWith('ENTLADUNG')).toBe(false);
    expect(memory.chargeReady).toBe(true);
    expect(memory.bank).toBeGreaterThanOrEqual(0);
  });
});
