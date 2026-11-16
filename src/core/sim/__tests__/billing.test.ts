/**
 * @test-target: src/core/sim/billing.ts
 * @error-code: ERR-2001
 *
 * Die Wochenrechnung ist genau einmal je Periode faellig, jede Zahlung ist eine
 * Ledger-Buchung, und der Merker im Save verhindert den Doppelabzug nach Reload.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, ZERO_VC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import {
  BILL_PERIOD_DAYS, billingView, creditLine, creditOutstanding, deferBill,
  runBillingCycle, takeCredit, weeklyBill, repayCredit,
} from '../billing';
import { CREDIT_ACCOUNT, DEBT_ACCOUNT, HAUSKONTO, PORTEMONNAIE, UTILITIES } from '../money';
import { TX_REASON } from '../tx-reasons';
import { buyProperty } from '../property';
import { createWorld } from '../templates';

function setup(houseVC = 500, walletVC = 200, property = false) {
  const world = createWorld('SMALL');
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(houseVC), [PORTEMONNAIE]: fromVC(walletVC) });
  if (property) buyProperty(world, ledger, 'KNEIPE', 0);
  world.day = BILL_PERIOD_DAYS;
  world.tick = BILL_PERIOD_DAYS * 1_000;
  return { world, ledger };
}

const billEntries = (ledger: Ledger) => ledger.entries.filter((entry) => entry.reason === TX_REASON.BILL);

describe('Wochenrechnung: Faelligkeit und Buchung', () => {
  it('bucht die Abgabe genau einmal je Periode und aus dem Hauskonto', () => {
    const { world, ledger } = setup();
    const { total } = weeklyBill(world, ledger);
    expect(total).toBeGreaterThan(ZERO_VC);

    const notice = runBillingCycle(world, ledger)!;
    expect(notice).toContain('bezahlt');
    expect(billEntries(ledger)).toHaveLength(1);
    expect(ledger.getBalance(UTILITIES)).toBe(total);

    // Zweiter Aufruf am selben Tag: kein zweiter Abzug.
    expect(runBillingCycle(world, ledger)).toBeNull();
    expect(billEntries(ledger)).toHaveLength(1);
    expect(world.player.billing.lastBilledDay).toBe(BILL_PERIOD_DAYS);
  });

  it('ist an einem anderen Tag nicht faellig', () => {
    const { world, ledger } = setup();
    world.day = BILL_PERIOD_DAYS - 1;
    expect(runBillingCycle(world, ledger)).toBeNull();
    expect(billEntries(ledger)).toHaveLength(0);
  });

  it('zieht die Kreditrate mit der Abgabe ein', () => {
    const { world, ledger } = setup();
    takeCredit(world, ledger, 40, 0);
    const { housing, installment, total } = weeklyBill(world, ledger);
    expect(installment).toBe(fromVC(4));
    expect(total).toBe(housing + installment);

    runBillingCycle(world, ledger);
    expect(billEntries(ledger)[0]!.amount).toBe(total);
  });
});

describe('Wochenrechnung: Verzug', () => {
  it('bucht bei zu wenig Kasse eine Verbindlichkeit plus Verzugsgebuehr', () => {
    const { world, ledger } = setup(1, 0);
    const before = ledger.getBalance(HAUSKONTO);

    const notice = runBillingCycle(world, ledger)!;

    expect(notice).toContain('Verzug');
    expect(ledger.getBalance(HAUSKONTO)).toBe(ZERO_VC);
    expect(ledger.getBalance(HAUSKONTO)).toBeLessThanOrEqual(before);
    expect(ledger.getBalance(DEBT_ACCOUNT)).toBeLessThan(ZERO_VC);
    expect(ledger.entries.some((entry) => entry.reason === TX_REASON.BILL_LATE)).toBe(true);
    expect(world.player.billing.overdueWeeks).toBe(1);
  });

  it('stundet bewusst als Verbindlichkeit ohne Kassenabgang', () => {
    const { world, ledger } = setup();
    const house = ledger.getBalance(HAUSKONTO);

    deferBill(world, ledger, world.tick);

    expect(ledger.getBalance(HAUSKONTO)).toBe(house);
    expect(ledger.getBalance(DEBT_ACCOUNT)).toBeLessThan(ZERO_VC);
    expect(world.player.billing.overdueWeeks).toBe(1);
  });
});

describe('Bankentscheidungen ueber das Kreditkonto', () => {
  it('nimmt einen Kredit innerhalb der Linie auf und tilgt ihn zurueck', () => {
    const { world, ledger } = setup(0, 0);
    const line = creditLine(world, ledger);
    expect(line).toBe(fromVC(50));

    takeCredit(world, ledger, 40, 0);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(40));
    expect(creditOutstanding(ledger)).toBe(fromVC(40));
    expect(creditLine(world, ledger)).toBe(fromVC(10));
    expect(() => takeCredit(world, ledger, 20, 0)).toThrow(/Kreditlinie/);

    repayCredit(world, ledger, 25, 0);
    expect(creditOutstanding(ledger)).toBe(fromVC(15));
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(15));
    expect(ledger.getBalance(CREDIT_ACCOUNT)).toBe(-fromVC(15));
  });

  it('verweigert die Tilgung ohne Bargeld', () => {
    const { world, ledger } = setup(0, 40);
    takeCredit(world, ledger, 40, 0);
    ledger.transfer(PORTEMONNAIE, HAUSKONTO, fromVC(80), 'test', 0);
    expect(() => repayCredit(world, ledger, 40, 0)).toThrow(/Nicht genug Bargeld/);
    expect(creditOutstanding(ledger)).toBe(fromVC(40));
  });

  it('erhoeht die Linie mit einer Immobilie', () => {
    const plain = setup(0, 0);
    const owned = setup(0, 200, true);
    expect(creditLine(owned.world, owned.ledger)).toBeGreaterThan(creditLine(plain.world, plain.ledger));
  });
});

describe('Abrechnung ueber Save und Load', () => {
  it('erhaelt Faelligkeit, Betrag und Merker ohne Doppelabzug', () => {
    const { world, ledger } = setup();
    runBillingCycle(world, ledger);
    const due = billingView(world, ledger).due;

    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, 5))))!;

    expect(billingView(loaded.world, loaded.ledger).due).toBe(due);
    expect(loaded.world.player.billing).toEqual(world.player.billing);
    expect(runBillingCycle(loaded.world, loaded.ledger)).toBeNull();
    expect(loaded.ledger.entries.filter((entry) => entry.reason === TX_REASON.BILL)).toHaveLength(1);
  });

  it('normalisiert alte Saves ohne Abrechnungsfelder', () => {
    const { world, ledger } = setup();
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 5)));
    delete saved.player.billing;

    const loaded = replaySave(saved)!;

    expect(loaded.world.player.billing).toEqual({ lastBilledDay: 0, overdueWeeks: 0 });
    expect(loaded.ledger.getBalance(HAUSKONTO)).toBeGreaterThanOrEqual(ZERO_VC);
    expect(new Prng(randomSeed()).getState()).toBeGreaterThan(0);
  });
});
