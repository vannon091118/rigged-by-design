/**
 * Woechentlicher Abrechnungszyklus mit echten Bankentscheidungen.
 *
 * Eine Periode sind sieben Weltage. Faellig sind die Immobilienabgabe (bzw. eine
 * Grundgebuehr ohne Immobilie) und die Rate eines offenen Bankkredits. Jede
 * Zahlung ist eine Ledger-Buchung; ein offener Betrag wird zur Verbindlichkeit
 * mit Verzugsgebuehr, nicht zu einem stillen Minus. Es gibt keinen zweiten
 * Geld- oder Schuldenzaehler: der Kreditstand ist der Saldo des Kreditkontos.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { recordJournal } from './journal';
import { CREDIT_ACCOUNT, DEBT_ACCOUNT, HAUSKONTO, PORTEMONNAIE, UTILITIES, payOrBorrow } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';
import { dailyHousingCost } from './upkeep-costs';
import type { PlayerBilling } from './player-state';

export const BILL_PERIOD_DAYS = 7;
/** 2 % des Immobilienpreises je Woche; ohne Immobilie die Grundgebuehr eines Tages. */
const PROPERTY_RATE_BPS = 200;
/** 10 % des offenen Kredits werden je Woche als Rate faellig. */
const CREDIT_RATE_BPS = 1_000;
/** Verzug kostet 5 % der Rechnung, mindestens 1 VC. */
const LATE_FEE_BPS = 500;
const MIN_LATE_FEE = fromVC(1);
const BASE_CREDIT_LINE = fromVC(50);

interface BillingView {
  readonly due: VaCoinMicro;
  readonly housing: VaCoinMicro;
  readonly installment: VaCoinMicro;
  readonly dueNow: boolean;
  readonly lastBilledDay: number;
  readonly overdueWeeks: number;
  readonly creditOutstanding: VaCoinMicro;
  readonly creditLine: VaCoinMicro;
}

/** Alte Saves und kaputte Eingaben: Zaehler nie negativ, nie in der Zukunft. */
export function normalizeBilling(raw: unknown): PlayerBilling {
  if (!raw || typeof raw !== 'object') return { lastBilledDay: 0, overdueWeeks: 0 };
  const value = raw as Partial<PlayerBilling>;
  const day = Number.isFinite(value.lastBilledDay) ? Math.max(0, Math.floor(value.lastBilledDay!)) : 0;
  const overdue = Number.isFinite(value.overdueWeeks) ? Math.max(0, Math.floor(value.overdueWeeks!)) : 0;
  return { lastBilledDay: day, overdueWeeks: overdue };
}

/** Der Kreditstand ist der negative Saldo des Kreditkontos, kein zweiter Zaehler. */
export function creditOutstanding(ledger: Ledger): VaCoinMicro {
  return Math.max(0, -ledger.getBalance(CREDIT_ACCOUNT)) as VaCoinMicro;
}

/** Verfuegbare Linie: Grundbetrag plus ein Zwoelftel des Immobilienwerts, minus Kredit. */
export function creditLine(world: WorldState, ledger: Ledger): VaCoinMicro {
  const property = world.player.property;
  const value = property === null ? ZERO_VC : (property.priceVC / 12) as VaCoinMicro;
  return Math.max(0, BASE_CREDIT_LINE + value - creditOutstanding(ledger)) as VaCoinMicro;
}

/** Die faellige Rechnung setzt sich aus vorhandenen Quellen zusammen. */
export function weeklyBill(world: WorldState, ledger: Ledger): { housing: VaCoinMicro; installment: VaCoinMicro; total: VaCoinMicro } {
  const property = world.player.property;
  const housing = (property === null
    ? dailyHousingCost(world.prices)
    : Math.round((property.priceVC * PROPERTY_RATE_BPS) / 10_000)) as VaCoinMicro;
  const installment = Math.round((creditOutstanding(ledger) * CREDIT_RATE_BPS) / 10_000) as VaCoinMicro;
  return { housing, installment, total: (housing + installment) as VaCoinMicro };
}

function isBillDue(world: WorldState): boolean {
  return world.day >= BILL_PERIOD_DAYS
    && world.day % BILL_PERIOD_DAYS === 0
    && world.player.billing.lastBilledDay < world.day;
}

function finish(world: WorldState, notice: string, cause: string): string {
  world.lastEvent = notice;
  recordJournal(world, { kind: 'SYSTEM', subject: 'RECHNUNG', cause, effect: notice, refs: {} });
  return notice;
}

/**
 * Bucht die faellige Rechnung genau einmal je Periode. Der Merker `lastBilledDay`
 * liegt im Save, damit ein Reload am selben Tag nicht doppelt abbucht.
 */
export function runBillingCycle(world: WorldState, ledger: Ledger): string | null {
  if (!isBillDue(world)) return null;
  const billing = world.player.billing;
  billing.lastBilledDay = world.day;
  const { housing, installment, total } = weeklyBill(world, ledger);
  if (total <= ZERO_VC) return null;
  const parts = installment > ZERO_VC
    ? `Abgabe ${toVCString(housing)}, Kreditrate ${toVCString(installment)}`
    : `Abgabe ${toVCString(housing)}`;
  if (ledger.getBalance(HAUSKONTO) >= total) {
    ledger.transfer(HAUSKONTO, UTILITIES, total, TX_REASON.BILL, world.tick);
    return finish(world, `Wochenrechnung ${toVCString(total)} bezahlt (${parts}).`, 'Wochenrechnung bezahlt');
  }
  payOrBorrow(ledger, UTILITIES, total, TX_REASON.BILL, world.tick);
  const late = Math.max(MIN_LATE_FEE, Math.round((total * LATE_FEE_BPS) / 10_000)) as VaCoinMicro;
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, UTILITIES, late, TX_REASON.BILL_LATE, world.tick);
  billing.overdueWeeks += 1;
  return finish(world,
    `Wochenrechnung ${toVCString(total)} nicht gedeckt: ${toVCString(late)} Verzug, Woche ${billing.overdueWeeks} offen (${parts}).`,
    'Wochenrechnung in Verzug');
}

/** Kredit aufnehmen: Geld kommt vom Kreditkonto, die Linie sinkt entsprechend. */
export function takeCredit(world: WorldState, ledger: Ledger, amountVC: number, tick: number): string {
  const amount = fromVC(amountVC);
  if (amount <= ZERO_VC) throw new Error('Der Kreditbetrag muss groesser als null sein.');
  if (amount > creditLine(world, ledger)) {
    throw new Error(`Kreditlinie reicht nicht: ${toVCString(creditLine(world, ledger))} verfuegbar.`);
  }
  ledger.openLiability(CREDIT_ACCOUNT);
  ledger.transfer(CREDIT_ACCOUNT, PORTEMONNAIE, amount, TX_REASON.CREDIT_DRAW, tick);
  return finish(world, `Kredit ueber ${toVCString(amount)} aufgenommen.`, 'Bankkredit aufgenommen');
}

/** Tilgung aus dem Portemonnaie; nie mehr als offen, nie unter null. */
export function repayCredit(world: WorldState, ledger: Ledger, amountVC: number, tick: number): string {
  const outstanding = creditOutstanding(ledger);
  const wanted = fromVC(amountVC);
  const amount = (wanted < outstanding ? wanted : outstanding) as VaCoinMicro;
  if (amount <= ZERO_VC) throw new Error('Kein offener Kredit.');
  if (ledger.getBalance(PORTEMONNAIE) < amount) {
    throw new Error(`Nicht genug Bargeld. Offen: ${toVCString(outstanding)}.`);
  }
  ledger.transfer(PORTEMONNAIE, CREDIT_ACCOUNT, amount, TX_REASON.CREDIT_REPAY, tick);
  return finish(world, `Kredit ueber ${toVCString(amount)} getilgt.`, 'Bankkredit getilgt');
}

/** Stundung: die Rechnung wird bewusst zur Verbindlichkeit statt aus der Kasse bezahlt. */
export function deferBill(world: WorldState, ledger: Ledger, tick: number): string {
  const { total } = weeklyBill(world, ledger);
  if (total <= ZERO_VC) throw new Error('Keine Rechnung offen.');
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, UTILITIES, total, TX_REASON.BILL_DEFERRED, tick);
  world.player.billing.overdueWeeks += 1;
  return finish(world, `Wochenrechnung ${toVCString(total)} gestundet.`, 'Wochenrechnung gestundet');
}

export function billingView(world: WorldState, ledger: Ledger): BillingView {
  const { housing, installment, total } = weeklyBill(world, ledger);
  return {
    due: total,
    housing,
    installment,
    dueNow: isBillDue(world),
    lastBilledDay: world.player.billing.lastBilledDay,
    overdueWeeks: world.player.billing.overdueWeeks,
    creditOutstanding: creditOutstanding(ledger),
    creditLine: creditLine(world, ledger),
  };
}
