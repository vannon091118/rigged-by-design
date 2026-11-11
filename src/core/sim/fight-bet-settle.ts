/**
 * Vorkampf und Abrechnung: der Vorkampf wird genau einmal simuliert, offene
 * Scheine werden gegen dieses Ergebnis gebucht. Ohne Vorkampf geht der Einsatz
 * zurueck. Der Aufruf ist idempotent, weil der Abrechnungsbeleg die
 * Schein-Nummer traegt.
 */
import type { Ledger } from '../economy/ledger';
import { toVCString, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { fighters, simulateFight } from './brawl-combat';
import { liveTournament, rpgOf, undercardPair } from './fight-bets';
import {
  openSlips, SETTLE_SUBJECT, undercardOf, UNDERCARD_SUBJECT, type UndercardResult,
} from './fight-bet-slips';
import { fightOpponentOf } from './fight-career';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { isLiveEventStatus } from './narrative/event-lifecycle';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';

/** Simuliert den Vorkampf genau einmal und legt das Ergebnis ins Archiv. */
export function runUndercard(world: WorldState, prng: Prng): UndercardResult | null {
  const live = liveTournament(world);
  const pair = undercardPair(world);
  if (!live || !pair) return null;
  const known = undercardOf(world, live.id);
  if (known) return known;
  const [a, b] = pair;
  const [left, right] = fighters(rpgOf(a), fightOpponentOf(b), world.guests.length);
  const fight = simulateFight(left, right, prng);
  const winner: 'A' | 'B' = fight.playerWon ? 'A' : 'B';
  const loserHp = fight.playerWon ? fight.opponentHp : fight.playerHp;
  const result: UndercardResult = {
    eventId: live.id, a: a.name, b: b.name, winner,
    method: loserHp === 0 ? 'KO' : 'PUNKTE', rounds: fight.rounds,
  };
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: UNDERCARD_SUBJECT,
    cause: `event:${live.id}|sieger:${winner}|methode:${result.method}|runden:${result.rounds}|paar:${a.name} gegen ${b.name}`,
    effect: `Vorkampf: ${winner === 'A' ? a.name : b.name} gewinnt ${result.method === 'KO' ? 'durch KO' : 'nach Punkten'} in Runde ${result.rounds}.`,
  });
  return result;
}

/** Rechnet offene Scheine ab, sobald der Abend terminal ist. */
export function settleFightBets(world: WorldState, ledger: Ledger): number {
  let settled = 0;
  for (const bet of openSlips(world)) {
    const event = world.narrative.events.find((entry) => entry.id === bet.eventId);
    if (!event || isLiveEventStatus(event.status)) continue;
    const result = undercardOf(world, bet.eventId);
    const won = result !== null && (
      (bet.pick === 'A' && result.winner === 'A')
      || (bet.pick === 'B' && result.winner === 'B')
      || bet.pick === result.method
    );
    if (!result) {
      ledger.transfer(EXTERNAL, PORTEMONNAIE, bet.stake, TX_REASON.FIGHT_BET_REFUND, world.tick);
      recordJournal(world, {
        kind: 'SYSTEM', subject: SETTLE_SUBJECT,
        cause: `schein:${bet.slip}|event:${bet.eventId}|rueckgabe`,
        effect: `Wette zurueck: Abend ohne Vorkampf beendet · ${toVCString(bet.stake)}.`,
        amount: bet.stake,
      });
    } else if (won) {
      const payout = Math.round(bet.stake * bet.odds) as VaCoinMicro;
      ledger.transfer(EXTERNAL, PORTEMONNAIE, payout, TX_REASON.FIGHT_BET_PAYOUT, world.tick);
      recordJournal(world, {
        kind: 'SYSTEM', subject: SETTLE_SUBJECT,
        cause: `schein:${bet.slip}|event:${bet.eventId}|gewonnen`,
        effect: `Wette gewonnen: ${bet.pick} zu Quote ${bet.odds.toFixed(2)} · ${toVCString(payout)}.`,
        amount: payout,
      });
    } else {
      recordJournal(world, {
        kind: 'SYSTEM', subject: SETTLE_SUBJECT,
        cause: `schein:${bet.slip}|event:${bet.eventId}|verloren`,
        effect: `Wette verloren: ${bet.pick} · ${toVCString(bet.stake)}.`,
        amount: bet.stake,
      });
    }
    settled += 1;
  }
  return settled;
}
