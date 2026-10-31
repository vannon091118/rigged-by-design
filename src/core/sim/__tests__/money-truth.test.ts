/**
 * @test-target: src/core/sim/money.ts
 * @error-code: ERR-1002
 *
 * Fiat ist vom Spawn an ein gebuchtes Konto; Auszahlungen werden nie still gekappt.
 */
import { describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { mulVC, type VaCoinMicro } from '../../economy/vacoin';
import { playSlot } from '../../games/engines/slot';
import { Prng } from '../../rng/prng';
import { actAtTarget } from '../guest-play';
import { DEBT_ACCOUNT, fiatAccount, guestAccount, pendingAccount } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import { exchangePoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  return { world: createWorld('SMALL'), ledger: new Ledger(), prng: new Prng(randomSeed()) };
}

describe('Fiat am Spawn und an der Kasse', () => {
  it('bucht mitgebrachtes Fiat beim Spawn als eigenes Ledger-Konto', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    expect(ledger.getBalance(fiatAccount(guest.id))).toBeGreaterThan(0);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('wechselt das Fiat an der Kasse vollstaendig in Chips und leert das Fiat-Konto', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    const fiat = ledger.getBalance(fiatAccount(guest.id));
    expect(fiat).toBeGreaterThan(0);
    for (let step = 0; step < 20 && ledger.getBalance(fiatAccount(guest.id)) > 0; step += 1) {
      tickWorld(world, ledger, prng);
    }
    expect(ledger.getBalance(fiatAccount(guest.id))).toBe(0);
    const chips = ledger.getBalance(guestAccount(guest.id)) + ledger.getBalance(pendingAccount(guest.id));
    expect(chips).toBe(fiat);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('laesst Fiat und Gast stehen, wenn der Kassenwechsel scheitert', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    const before = ledger.getBalance(fiatAccount(guest.id));
    expect(before).toBeGreaterThan(0);
    guest.position = { ...exchangePoint(world)! };
    guest.state = 'EXCHANGE';
    guest.queueIndex = 0;
    guest.stateTicks = 1;
    guest.path = [];
    const real = ledger.transfer.bind(ledger);
    const spy = vi.spyOn(ledger, 'transfer').mockImplementation(((...args: Parameters<Ledger['transfer']>) => {
      if (args[0] === fiatAccount(guest.id)) throw new Error('Kasse klemmt');
      return real(...args);
    }) as Ledger['transfer']);
    tickWorld(world, ledger, prng);
    spy.mockRestore();
    expect(world.guests.some((entry) => entry.id === guest.id)).toBe(true);
    expect(ledger.getBalance(fiatAccount(guest.id))).toBe(before);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});

describe('Auszahlung und Deckung', () => {
  it('zahlt einen Gewinn ueber dem Hausbestand voll aus und bucht die Differenz als Schuld', () => {
    const { world, ledger } = setup();
    const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
    const slot = world.furniture.find((item) => item.kind === 'SLOT')!;
    const bet = (slot.baseBet > world.prices.slotMinBet ? slot.baseBet : world.prices.slotMinBet) as VaCoinMicro;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), bet, 'test chips', 0);
    let seed = 0;
    let win = 0;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const candidate = randomSeed();
      // Der Seed muss auf der Walzenzahl dieses Geraets gewinnen, nicht auf fuenf.
      const rolled = playSlot(new Prng(candidate), { reels: slot.reels });
      if (rolled.multiplierBps > 10_000) { seed = candidate; win = rolled.multiplierBps; break; }
    }
    expect(win).toBeGreaterThan(10_000);
    guest.state = 'PLAY';
    guest.stateTicks = 0;
    actAtTarget(world, ledger, new Prng(seed), guest, slot);
    const gross = mulVC(bet, win);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(gross);
    // Der Einsatz deckte einen Teil; der Rest ist eine gebuchte Schuld statt einer Kappung.
    expect(ledger.getBalance(DEBT_ACCOUNT)).toBe(-(gross - bet));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
