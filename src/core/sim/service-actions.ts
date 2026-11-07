/** Gast-Aktionen: ausstehende Gelder an Gäste auszahlen. Reine Welt-Logik ohne Tick. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { WorldState } from './types';
import { guestById } from './world';

export function payGuest(world: WorldState, ledger: Ledger, guestId: number, tick: number): VaCoinMicro {
  const amount = ledger.getBalance(`PENDING_${guestId}`);
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(`PENDING_${guestId}`, `VISITOR_${guestId}`, amount, `gast ${guestId} auszahlung`, tick);
  const guest = guestById(world, guestId);
  if (guest) {
    guest.mood = Math.min(100, guest.mood + 6);
    guest.patience = Math.min(100, guest.patience + 5);
  }
  return amount;
}
