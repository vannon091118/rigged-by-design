/**
 * @test-target: src/core/games/slot-session.ts
 * @proof-class: statistics
 * @error-code: ERR-1003
 *
 * Der Pfad, den Gaeste wirklich spielen, muss dem Haus einen Vorteil lassen.
 * Der Drucklader wird erst frei, wenn der Bankstand die tatsaechliche Auszahlung deckt.
 */
import { describe, expect, it } from 'vitest';
import { addVC, fromVC, mulVC } from '../../economy/vacoin';
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

function chargedMemory(bank = 0) {
  return {
    spinsToday: 0, spinsSinceLastJackpot: 0, averageJackpotInterval: 1000, currentDrift: -1000,
    recentSymbolHistogram: {}, recentSpins: [], pressureLevel: 7, chargeReady: true, bank,
  };
}

/** Ein zufaelliger Start, dessen Spin kein Jackpot ist: nur der laesst die Ladung stehen. */
function seedWithLoadedCharge(): number {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const seed = randomSeed();
    const probe = machine();
    probe.slotMemory = chargedMemory();
    playSlotSession(probe, new Prng(seed), fromVC(0.5));
    if (probe.slotMemory.chargeReady) return seed;
  }
  throw new Error('Kein ruhiger Seed ohne Jackpot gefunden.');
}

describe('Slot-Session', () => {
  it('zahlt ueber viele Spins weniger aus als eingenommen', { timeout: 300_000 }, () => {
    // Feste Seeds statt randomSeed(): die RTP-Streuung ueber acht Seeds reicht
    // von 0.915 bis 0.953. Ein einzelner Zufallslauf kann das Band reissen,
    // ohne dass sich am Auszahlungspfad etwas geaendert hat - der Nachweis
    // muss deshalb reproduzierbar sein und den Mittelwert pruefen.
    const bet = fromVC(0.5);
    const spins = 60_000;
    const seeds = [1, 2, 3, 4];
    let stake = 0;
    let payout = 0;
    let discharges = 0;
    for (const seed of seeds) {
      const prng = new Prng(seed);
      const item = machine();
      for (let index = 0; index < spins; index += 1) {
        const result = playSlotSession(item, prng, bet);
        stake += result.stake;
        payout += result.payout;
        if (result.label.startsWith('ENTLADUNG')) discharges += 1;
      }
    }
    const rtp = payout / stake;
    expect(stake).toBe(spins * bet * seeds.length);
    expect(discharges, 'Entladungen kommen vor').toBeGreaterThan(0);
    // 60.000 Spins halten die Streuung klein genug fuer ein echtes RTP-Band.
    expect(rtp, 'RTP der Gast-Session').toBeGreaterThan(0.90);
    expect(rtp, 'RTP der Gast-Session').toBeLessThan(0.96);
  });

  it('gibt eine Entladung nur aus einbehaltenem Polster', () => {
    const prng = new Prng(seedWithLoadedCharge());
    const item = machine();
    const bet = fromVC(0.5);
    const memory = item.slotMemory = chargedMemory();
    const result = playSlotSession(item, prng, bet);
    expect(result.label.startsWith('ENTLADUNG')).toBe(false);
    expect(memory.chargeReady).toBe(true);
    expect(memory.bank).toBeGreaterThanOrEqual(0);
  });

  it('deckt die Entladung am tatsaechlichen Auszahlungsbetrag', () => {
    const seed = seedWithLoadedCharge();
    const bet = fromVC(0.5);
    const bonus = 120;
    const payout = addVC(bet, mulVC(bet, bonus));

    const blocked = machine();
    const blockedMemory = blocked.slotMemory = chargedMemory(payout - 1);
    const first = playSlotSession(blocked, new Prng(seed), bet, bonus);
    expect(first.label.startsWith('ENTLADUNG')).toBe(false);
    expect(blockedMemory.chargeReady).toBe(true);

    const covered = machine();
    const coveredMemory = covered.slotMemory = chargedMemory(payout);
    const second = playSlotSession(covered, new Prng(seed), bet, bonus);
    expect(second.label.startsWith('ENTLADUNG')).toBe(true);
    expect(second.payout).toBe(payout);
    expect(coveredMemory.chargeReady).toBe(false);
    expect(coveredMemory.bank).toBe(bet);
  });
});
