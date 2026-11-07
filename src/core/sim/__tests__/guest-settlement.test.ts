/**
 * @test-target: src/core/sim/remodel.ts
 * @error-code: ERR-2001
 *
 * Kein Gast und kein Anspruch verschwindet, solange die Buchung nicht vollstaendig ist.
 */
import { describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { settleGuests } from '../actions';
import { fiatAccount, guestAccount, HAUSKONTO, pendingAccount } from '../money';
import { remodel } from '../remodel';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger(), prng: new Prng(randomSeed()) };
}

function fundedGuest(world = createWorld('SMALL'), ledger = new Ledger()) {
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
  ledger.transfer('EXTERNAL_WORLD', pendingAccount(guest.id), fromVC(2), 'test win', 0);
  return { world, ledger, guest };
}

describe('Abrechnung', () => {
  it('entfernt keinen Gast und keinen Anspruch, wenn eine Buchung scheitert', () => {
    const { world, ledger, guest } = fundedGuest(setup().world);
    const spy = vi.spyOn(ledger, 'transfer').mockImplementation(() => { throw new Error('Kasse klemmt'); });
    expect(() => settleGuests(world, ledger)).toThrow();
    spy.mockRestore();
    expect(world.guests.some((entry) => entry.id === guest.id)).toBe(true);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(fromVC(2));
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(fromVC(5));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('schliesst bei erfolgreicher Abrechnung Fiat, Chips und Gewinn vollstaendig', () => {
    const { world, ledger, guest } = fundedGuest();
    const fiat = ledger.getBalance(fiatAccount(guest.id));
    expect(fiat).toBeGreaterThan(0);
    settleGuests(world, ledger);
    expect(world.guests).toHaveLength(0);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(fiatAccount(guest.id))).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('zahlt keinen Gast doppelt aus, wenn eine spaetere Buchung scheitert', () => {
    const { world, ledger } = setup();
    const g1 = spawnGuest(world, new Prng(randomSeed()), ledger)!;
    const g2 = spawnGuest(world, new Prng(randomSeed()), ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(g1.id), fromVC(5), 'chips g1', 0);
    ledger.transfer('EXTERNAL_WORLD', pendingAccount(g1.id), fromVC(2), 'win g1', 0);
    ledger.transfer('EXTERNAL_WORLD', guestAccount(g2.id), fromVC(5), 'chips g2', 0);
    ledger.transfer('EXTERNAL_WORLD', pendingAccount(g2.id), fromVC(2), 'win g2', 0);
    expect(world.guests).toHaveLength(2);

    const originalTransfer = ledger.transfer.bind(ledger);
    const transferSpy = vi.spyOn(ledger, 'transfer');
    let calls = 0;
    transferSpy.mockImplementation((from: string, to: string, amount: VaCoinMicro, reason: string, tick: number) => {
      calls += 1;
      // Gast 1 braucht 5 echte Buchungen (payPending 1x, exchangeFromVc 2x, closeFiat 2x),
      // dann scheitert Gast 2 an seiner ersten Buchung.
      if (calls > 5) throw new Error('Kasse klemmt');
      return originalTransfer(from, to, amount, reason, tick);
    });

    expect(() => settleGuests(world, ledger)).toThrow();
    transferSpy.mockRestore();

    expect(world.guests.some((entry) => entry.id === g1.id)).toBe(false);
    expect(ledger.getBalance(guestAccount(g1.id))).toBe(0);
    expect(ledger.getBalance(pendingAccount(g1.id))).toBe(0);
    expect(world.guests.some((entry) => entry.id === g2.id)).toBe(true);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});

describe('Umbau', () => {
  it('laesst beim Ausbau Gast, Chips und offenen Gewinn unangetastet', () => {
    const { world, ledger, guest } = fundedGuest();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(200), 'baukapital', 0);
    world.day = 4;
    world.reputation = 40;
    world.guestsServed = 30;
    const before = ledger.getBalance(HAUSKONTO);
    const next = remodel(world, ledger, 'MEDIUM', 5);
    expect(next.template).toBe('MEDIUM');
    // Nur die Differenz SMALL->MEDIUM wird gebucht, nicht der volle Neubaupreis.
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(90));
    expect(next.guests.some((entry) => entry.id === guest.id)).toBe(true);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(fromVC(5));
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(fromVC(2));
    expect(ledger.getBalance(fiatAccount(guest.id))).toBeGreaterThan(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bricht den Ausbau bei Unterdeckung ab und laesst Welt und Hauskonto unberuehrt', () => {
    const { world, ledger, guest } = fundedGuest();
    world.day = 4;
    world.reputation = 40;
    world.guestsServed = 30;
    const before = ledger.getBalance(HAUSKONTO);
    expect(() => remodel(world, ledger, 'MEDIUM', 5)).toThrow();
    expect(world.template).toBe('SMALL');
    expect(world.size).toBe(30);
    expect(world.guests.some((entry) => entry.id === guest.id)).toBe(true);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
