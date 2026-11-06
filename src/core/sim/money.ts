/** Geldwege: jeder Cent ist eine Ledger-Buchung, nie ein direkter Zähler. */
import type { Ledger } from '../economy/ledger';
import { MINTING_ACCOUNT } from '../economy/ledger-integrity';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { guestReason, TX_REASON } from './tx-reasons';
import { emit } from './events';

export const HAUSKONTO = 'HAUSKONTO';
export const PORTEMONNAIE = 'PORTEMONNAIE';
export const WECHSELKASSE = 'WECHSELKASSE';
/** Aussenwelt-Konto; die Schreibweise kommt aus der Ledger-Pruefung, nicht von hier. */
export const EXTERNAL = MINTING_ACCOUNT;
export const SHOP = 'SHOP';
export const STAFF = 'STAFF';
export const UTILITIES = 'UTILITIES';
/** Arbeitsleistung finanziert den Disziplin-Bonus; PLAYER_CASH ist das ehrliche Gegenkonto. */
export const EXTERNAL_WORK = 'EXTERNAL_WORK';
export const PLAYER_CASH = 'PLAYER_CASH';
/** Gebuchte Verbindlichkeit: offener Gewinn, den das Hauskonto gerade nicht deckt. */
export const DEBT_ACCOUNT = 'HAUS_SCHULDEN';

/** Betriebsreserve, die beim Abheben im Hauskonto bleibt. */
export const HOUSE_FLOAT = fromVC(25);
/** Startkapital des Hauses: deckt Reparaturen und die erste Auszahlungswelle. */
const STARTING_CAPITAL = fromVC(150);

/** Der einzige Geldzufluss von aussen beim Start; jede weitere Zahl ist eine Buchung. */
export function openHouse(ledger: Ledger, tick: number): VaCoinMicro {
  ledger.transfer(EXTERNAL, HAUSKONTO, STARTING_CAPITAL, TX_REASON.START_CAPITAL, tick);
  return STARTING_CAPITAL;
}

export const guestAccount = (id: number): string => `VISITOR_${id}`;
export const pendingAccount = (id: number): string => `PENDING_${id}`;
export const fiatAccount = (id: number): string => `FIAT_${id}`;

/** Fiat kommt mit dem Gast herein und liegt ab dem Spawn als gebuchtes Guthaben im Ledger. */
export function admitFiat(ledger: Ledger, guestId: number, fiat: VaCoinMicro, tick: number): void {
  if (fiat <= ZERO_VC) return;
  ledger.transfer(EXTERNAL, fiatAccount(guestId), fiat, `gast ${guestId} fiat`, tick);
}

/** Wechselkasse: Fiat wandert in die Kasse, die Chips gehen an den Gast. */
export function exchangeFiat(ledger: Ledger, guestId: number, tick: number): VaCoinMicro {
  const amount = ledger.getBalance(fiatAccount(guestId));
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(fiatAccount(guestId), WECHSELKASSE, amount, `gast ${guestId} fiat wechseln`, tick);
  ledger.transfer(WECHSELKASSE, guestAccount(guestId), amount, `gast ${guestId} chips`, tick);
  return amount;
}

/** Nicht gewechseltes Fiat geht beim Verlassen zurueck, statt im Konto zu verwaisen. */
export function closeFiat(ledger: Ledger, guestId: number, tick: number): VaCoinMicro {
  const amount = ledger.getBalance(fiatAccount(guestId));
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(fiatAccount(guestId), WECHSELKASSE, amount, `gast ${guestId} fiat zurueck`, tick);
  ledger.transfer(WECHSELKASSE, EXTERNAL, amount, `gast ${guestId} fiat raus`, tick);
  return amount;
}

export function exchangeFromVc(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): VaCoinMicro {
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(guestAccount(guestId), WECHSELKASSE, amount, `gast ${guestId} auszahlen`, tick);
  ledger.transfer(WECHSELKASSE, EXTERNAL, amount, `gast ${guestId} cash out`, tick);
  return amount;
}

export function placeBet(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): void {
  ledger.transfer(guestAccount(guestId), HAUSKONTO, amount, guestReason('STAKE', guestId), tick);
}

/** Volle Auszahlung: was das Hauskonto nicht deckt, wird als Schuld gebucht statt gekappt. */
export function payOut(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  const house = ledger.getBalance(HAUSKONTO);
  const covered = (amount < house ? amount : house) as VaCoinMicro;
  if (covered > ZERO_VC) {
    ledger.transfer(HAUSKONTO, pendingAccount(guestId), covered, `gast ${guestId} gewinn`, tick);
  }
  const debt = (amount - covered) as VaCoinMicro;
  if (debt <= ZERO_VC) return;
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, pendingAccount(guestId), debt, `gast ${guestId} gewinn auf kredit`, tick);
  // Grossgewinn: visuelles Event fuer Partikel/Flash in der UI.
  if (amount >= fromVC(10)) {
    emit('money:bigPayout', { guestId, amount, covered, debt });
  }
}

/**
 * Laufende Kosten, die die Kasse gerade nicht deckt, laufen als Verbindlichkeit weiter:
 * Der Betrieb steht bei 0 Kapital still, aber er erstickt nicht an einer Reparatur.
 */
export function payOrBorrow(
  ledger: Ledger,
  account: string,
  amount: VaCoinMicro,
  reason: string,
  tick: number,
): void {
  if (amount <= ZERO_VC) return;
  const house = ledger.getBalance(HAUSKONTO);
  const covered = (amount < house ? amount : house) as VaCoinMicro;
  if (covered > ZERO_VC) ledger.transfer(HAUSKONTO, account, covered, reason, tick);
  const open = (amount - covered) as VaCoinMicro;
  if (open <= ZERO_VC) return;
  ledger.openLiability(DEBT_ACCOUNT);
  ledger.transfer(DEBT_ACCOUNT, account, open, `${reason} auf kredit`, tick);
}

/**
 * Schuldentilgung aus der Betriebsreserve: Das Haus behaelt HOUSE_FLOAT in der
 * Kasse und tilgt vom Ueberschuss. Es entsteht kein zweites Schuldenkonto; die
 * bestehende Verbindlichkeit wird nur zurueckgefuehrt.
 */
export function repayDebt(ledger: Ledger, tick: number): VaCoinMicro {
  if (!ledger.liabilityAccounts.includes(DEBT_ACCOUNT)) return ZERO_VC;
  const owed = Math.max(0, -ledger.getBalance(DEBT_ACCOUNT));
  const available = Math.max(0, ledger.getBalance(HAUSKONTO) - HOUSE_FLOAT);
  const amount = Math.min(owed, available);
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(HAUSKONTO, DEBT_ACCOUNT, amount as VaCoinMicro, TX_REASON.DEBT_REPAYMENT, tick);
  return amount as VaCoinMicro;
}

export function payPending(ledger: Ledger, guestId: number, tick: number): VaCoinMicro {
  const amount = ledger.getBalance(pendingAccount(guestId));
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(pendingAccount(guestId), guestAccount(guestId), amount, `gast ${guestId} auszahlung`, tick);
  return amount;
}

export function playerTakeHome(ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer(HAUSKONTO, PORTEMONNAIE, amount, TX_REASON.TAKE_HOME, tick);
}

export function foreignBet(ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  ledger.transfer(PORTEMONNAIE, EXTERNAL, amount, TX_REASON.FOREIGN_STAKE, tick);
}

export function foreignWin(ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer(EXTERNAL, PORTEMONNAIE, amount, TX_REASON.FOREIGN_WIN, tick);
}
