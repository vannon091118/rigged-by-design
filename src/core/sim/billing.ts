/** 7-Tage-Abrechnungsrhythmus: Rechnungen, Fristen, Spieler-Entscheidungen.
 *
 * Jede Rechnung ist eine Ledger-Verbindung. Es entsteht kein zweites
 * Geldsystem ausserhalb des Ledgers.
 */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { DEBT_ACCOUNT, HAUSKONTO, PORTEMONNAIE, VENDOR_BILLING } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState, Invoice } from './types';
import { addVC, subVC } from '../economy/vacoin';

/** Rechnungsrhythmus in Welt-Tagen. */
export const BILLING_CYCLE_DAYS = 7;

/** Finanzierungsgebühr: 10% des Rechnungsbetrags pro Finanzierung. */
function financeFee(amountVC: VaCoinMicro): VaCoinMicro {
  return Math.floor(amountVC * 0.1) as VaCoinMicro;
}

/** Stundungsgebühr: 5% des Rechnungsbetrags pro Stundung. */
function staggerFee(amountVC: VaCoinMicro): VaCoinMicro {
  return Math.floor(amountVC * 0.05) as VaCoinMicro;
}

/** Erzeugt die Wochen-Rechnungen aus vorhandenen Kostenquellen. */
export function generateInvoices(
  world: WorldState,
): Invoice[] {
  const newInvoices: Invoice[] = [];

  // Miete/Wohnung aus vorhandener Kostenquelle
  const rent = world.prices?.cleaningCost
    ? ((world.prices.cleaningCost * 2) as VaCoinMicro) * 7
    : (500 as VaCoinMicro);
  if (rent > ZERO_VC) {
    newInvoices.push({
      id: `inv-${world.day}-rent`,
      day: world.day,
      dueDay: world.day + BILLING_CYCLE_DAYS,
      amountVC: rent as VaCoinMicro,
      reason: 'miete woche',
      paid: false,
      stalled: false,
      financeFeeVC: ZERO_VC,
    });
  }

  // Versorgung/Strom
  const utilities = (rent / 2) as VaCoinMicro;
  if (utilities > ZERO_VC) {
    newInvoices.push({
      id: `inv-${world.day}-utilities`,
      day: world.day,
      dueDay: world.day + BILLING_CYCLE_DAYS,
      amountVC: utilities,
      reason: 'versorgung woche',
      paid: false,
      stalled: false,
      financeFeeVC: ZERO_VC,
    });
  }

  return newInvoices;
}

/** Prueft, ob eine neue Abrechnung faellig ist (alle 7 Tage). */
export function isBillingDue(world: WorldState): boolean {
  return world.day - world.lastBillingDay >= BILLING_CYCLE_DAYS;
}

/** Fuehrt die Wochenabrechnung durch: Rechnungen erzeugen, Ledger buchen. */
export function runBilling(
  world: WorldState,
  ledger: Ledger,
  tick: number,
): { invoices: Invoice[]; notice: string } {
  const newInvoices = generateInvoices(world);
  let totalVC = ZERO_VC;
  for (const inv of newInvoices) {
    totalVC = addVC(totalVC, inv.amountVC) as VaCoinMicro;
    // Verbindlichkeit anmelden (Rechnung entsteht als Schuldenposition)
    ledger.openLiability(DEBT_ACCOUNT);
    ledger.transfer(
      DEBT_ACCOUNT,
      VENDOR_BILLING,
      inv.amountVC,
      `${TX_REASON.INVOICE}: ${inv.reason} tag ${world.day}`,
      tick,
    );
  }
  world.lastBillingDay = world.day;
  world.invoices = [...world.invoices, ...newInvoices];

  let notice = `Abrechnung Tag ${world.day}: ${newInvoices.length} Rechnung(en) über ${totalVC} VC erstellt.`;
  if (newInvoices.length === 0) notice = `Abrechnung Tag ${world.day}: keine neuen Rechnungen.`;
  return { invoices: newInvoices, notice };
}

/** Zahlt eine Rechnung vollständig vom Portemonnaie oder Hauskonto. */
export function payInvoice(
  world: WorldState,
  ledger: Ledger,
  invoiceId: string,
  tick: number,
): { ok: boolean; notice: string; remainingVC: VaCoinMicro } {
  const idx = world.invoices.findIndex((inv) => inv.id === invoiceId && !inv.paid);
  if (idx < 0) {
    return { ok: false, notice: 'Rechnung nicht gefunden oder bereits bezahlt.', remainingVC: ZERO_VC };
  }
  const inv = world.invoices[idx]!;
  const balance = ledger.getBalance(PORTEMONNAIE);
  const house = ledger.getBalance(HAUSKONTO);

  let paidFromWallet = ZERO_VC;
  let paidFromHouse = ZERO_VC;
  let remaining = inv.amountVC;

  // Zuerst Portemonnaie, dann Hauskonto
  if (balance > ZERO_VC) {
    paidFromWallet = Math.min(balance, remaining) as VaCoinMicro;
    remaining = subVC(remaining, paidFromWallet);
    ledger.transfer(PORTEMONNAIE, DEBT_ACCOUNT, paidFromWallet, `${TX_REASON.INVOICE}: bezahlt ${inv.reason}`, tick);
  }
  if (remaining > ZERO_VC && house > ZERO_VC) {
    paidFromHouse = Math.min(house, remaining) as VaCoinMicro;
    remaining = subVC(remaining, paidFromHouse);
    ledger.transfer(HAUSKONTO, DEBT_ACCOUNT, paidFromHouse, `${TX_REASON.INVOICE}: bezahlt ${inv.reason}`, tick);
  }

  if (remaining > ZERO_VC) {
    return {
      ok: false,
      notice: `Nicht genug Geld: ${inv.amountVC} VC nötig, ${inv.amountVC} VC verfügbar.`,
      remainingVC: remaining,
    };
  }

  world.invoices[idx] = { ...inv, paid: true };
  const totalPaid = addVC(paidFromWallet, paidFromHouse) as VaCoinMicro;
  return {
    ok: true,
    notice: `Rechnung "${inv.reason}" bezahlt: ${totalPaid} VC.`,
    remainingVC: ZERO_VC,
  };
}

/** Stundet eine Rechnung um 7 Tage mit Gebühr. */
export function staggerInvoice(
  world: WorldState,
  ledger: Ledger,
  invoiceId: string,
  tick: number,
): { ok: boolean; notice: string; feeVC: VaCoinMicro } {
  const idx = world.invoices.findIndex((inv) => inv.id === invoiceId && !inv.paid && !inv.stalled);
  if (idx < 0) {
    return { ok: false, notice: 'Rechnung nicht gefunden, bereits bezahlt oder bereits gestundet.', feeVC: ZERO_VC };
  }
  const inv = world.invoices[idx]!;
  const fee = staggerFee(inv.amountVC);

  // Gebühr als neue Verbindlichkeit buchen
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, VENDOR_BILLING, fee, `${TX_REASON.INVOICE_STAGGER}: ${inv.reason}`, tick);

  world.invoices[idx] = {
    ...inv,
    stalled: true,
    dueDay: inv.dueDay + BILLING_CYCLE_DAYS,
    financeFeeVC: addVC(inv.financeFeeVC, fee) as VaCoinMicro,
  };

  return { ok: true, notice: `Rechnung "${inv.reason}" um 7 Tage gestundet. Gebühr: ${fee} VC.`, feeVC: fee };
}

/** Finanziert eine Rechnung als Kredit mit Zinsen. */
export function financeInvoice(
  world: WorldState,
  ledger: Ledger,
  invoiceId: string,
  tick: number,
): { ok: boolean; notice: string; feeVC: VaCoinMicro } {
  const idx = world.invoices.findIndex((inv) => inv.id === invoiceId && !inv.paid && !inv.stalled);
  if (idx < 0) {
    return { ok: false, notice: 'Rechnung nicht gefunden, bereits bezahlt oder bereits gestundet.', feeVC: ZERO_VC };
  }
  const inv = world.invoices[idx]!;
  const fee = financeFee(inv.amountVC);

  // Rechnung als bezahlt markieren (Kredit übernimmt den Betrag)
  world.invoices[idx] = { ...inv, paid: true };
  world.invoices.push({
    id: `loan-${world.day}-${invoiceId}`,
    day: world.day,
    dueDay: world.day + BILLING_CYCLE_DAYS * 2,
    amountVC: addVC(inv.amountVC, fee) as VaCoinMicro,
    reason: `finanzierung: ${inv.reason}`,
    paid: false,
    stalled: false,
    financeFeeVC: fee,
  });

  // Kredit als Verbindlichkeit buchen
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, VENDOR_BILLING, addVC(inv.amountVC, fee) as VaCoinMicro, `${TX_REASON.INVOICE_FINANCE}: ${inv.reason}`, tick);
  ledger.transfer(VENDOR_BILLING, DEBT_ACCOUNT, inv.amountVC, `${TX_REASON.INVOICE}: rechnung beglichen durch kredit: ${inv.reason}`, tick);

  return {
    ok: true,
    notice: `Rechnung "${inv.reason}" finanziert. Kredit über ${inv.amountVC} VC + Gebühr ${fee} VC.`,
    feeVC: fee,
  };
}

/** Gibt alle überfälligen, nicht bezahlten Rechnungen zurück. */
export function overdueInvoices(world: WorldState): Invoice[] {
  return world.invoices.filter((inv) => !inv.paid && world.day > inv.dueDay && !inv.stalled);
}

/** Gibt die Summe aller offenen, nicht gestundeten Rechnungen zurück. */
export function openInvoiceTotal(world: WorldState): VaCoinMicro {
  let total = ZERO_VC;
  for (const inv of world.invoices) {
    if (!inv.paid && !inv.stalled) total = addVC(total, inv.amountVC) as VaCoinMicro;
  }
  return total;
}
