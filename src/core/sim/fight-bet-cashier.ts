/**
 * Abgabe eines Scheins: der Ledger bucht den Einsatz, das Journal fixiert die
 * Quote. Der Schein ist damit ein Archiv-Beleg und braucht kein Save-Feld.
 */
import type { Ledger } from '../economy/ledger';
import { toVCString, type VaCoinMicro } from '../economy/vacoin';
import { fightBetView, MAX_STAKE, MIN_STAKE } from './fight-bets';
import { SLIP_SUBJECT, type FightBetPick } from './fight-bet-slips';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';

/** Ein Schein fixiert die Quote: der Ledger bucht den Einsatz sofort. */
export function placeFightBet(
  world: WorldState, ledger: Ledger, pick: FightBetPick, stake: VaCoinMicro,
): string {
  const view = fightBetView(world, ledger.getBalance(PORTEMONNAIE));
  if (!view.open || !view.market) throw new Error(view.reason);
  if (stake < MIN_STAKE || stake > MAX_STAKE) {
    throw new Error(`Einsatz ausserhalb des Markts: ${toVCString(MIN_STAKE)} bis ${toVCString(MAX_STAKE)}.`);
  }
  if (stake > ledger.getBalance(PORTEMONNAIE)) throw new Error('Nicht genug Bargeld fuer diesen Schein.');
  const odds = view.market.odds[pick];
  const slip = world.nextJournalId;
  ledger.transfer(PORTEMONNAIE, EXTERNAL, stake, TX_REASON.FIGHT_BET_STAKE, world.tick);
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: SLIP_SUBJECT,
    cause: `schein:${slip}|event:${view.market.eventId}|pick:${pick}|quote:${odds}|stake:${stake}`,
    effect: `Wette ${pick} auf ${view.market.pair} zu Quote ${odds.toFixed(2)} · ${toVCString(stake)}.`,
    amount: stake,
  });
  const notice = `Wette ${pick} auf ${view.market.pair} · Quote ${odds.toFixed(2)} · ${toVCString(stake)}.`;
  world.lastEvent = notice;
  return notice;
}
