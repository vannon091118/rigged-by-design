/** Abgeleitete Ledger- und Gastbloecke der einen Sicht; keine zweite Geldwahrheit. */
import type { Ledger } from '../core/economy/ledger';
import { addVC, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { fiatAccount, guestAccount, pendingAccount, DEBT_ACCOUNT, HAUSKONTO, PLAYER_CASH, PORTEMONNAIE, WECHSELKASSE } from '../core/sim/money';
import type { WorldState } from '../core/sim/types';
import { creditOutstanding } from '../core/sim/billing';

/** Kontostaende und Ledger-Gesundheit, wie sie die UI anzeigt. */
export function ledgerBlock(ledger: Ledger): {
  house: VaCoinMicro; debt: VaCoinMicro; credit: VaCoinMicro; desk: VaCoinMicro; wallet: VaCoinMicro; playerCash: VaCoinMicro;
  ledgerOk: boolean; ledgerEntries: number; ledgerLastSeq: number; ledgerCirculating: VaCoinMicro;
} {
  return {
    house: ledger.getBalance(HAUSKONTO),
    // Die Schuld ist der negative Saldo der Verbindlichkeit, nie ein zweiter Zaehler.
    debt: Math.max(0, -ledger.getBalance(DEBT_ACCOUNT)) as VaCoinMicro,
    // Offener Bankkredit ist der Saldo des Kreditkontos, kein zweiter Zaehler.
    credit: creditOutstanding(ledger),
    desk: ledger.getBalance(WECHSELKASSE),
    wallet: ledger.getBalance(PORTEMONNAIE),
    playerCash: ledger.getBalance(PLAYER_CASH),
    ledgerOk: ledger.verifyIncremental(),
    ledgerEntries: ledger.entryCount,
    ledgerLastSeq: ledger.entryCount - 1,
    ledgerCirculating: ledger.circulating,
  };
}

interface GuestMoney { wallet: VaCoinMicro; pending: VaCoinMicro; fiat: VaCoinMicro }

/** Je Gast die drei Konten plus die Summe der offenen Betraege und die Durchschnittslaune. */
export function guestMoneyBlock(world: WorldState, ledger: Ledger): {
  guestMoney: Record<number, GuestMoney>; pending: VaCoinMicro; mood: number;
} {
  let pending: VaCoinMicro = ZERO_VC;
  let mood = 0;
  const guestMoney: Record<number, GuestMoney> = {};
  for (const guest of world.guests) {
    const open = ledger.getBalance(pendingAccount(guest.id));
    guestMoney[guest.id] = {
      wallet: ledger.getBalance(guestAccount(guest.id)),
      pending: open,
      fiat: ledger.getBalance(fiatAccount(guest.id)),
    };
    pending = addVC(pending, open);
    mood += guest.mood;
  }
  return { guestMoney, pending, mood: world.guests.length ? Math.round(mood / world.guests.length) : 0 };
}
