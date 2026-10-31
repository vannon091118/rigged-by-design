/**
 * Automatik-Runde fuer Simulation, Test und Fremdhaeuser: dieselbe Hand wie am
 * Tisch, nur die Person an Position 0 spielt nach fester Strategie statt zu klicken.
 */
import type { Prng } from '../rng/prng';
import { decideAction, strengthOf } from './poker-strategy';
import { humanAct, startHand, toCall } from './poker-table';
import type { PokerResult } from './poker-types';

/** Massstab der Simulation: alle Groessen sind linear, der Faktor bleibt erhalten. */
const REFERENCE_STAKE = 10_000;

export function playPokerRound(prng: Prng): PokerResult {
  let table = startHand(prng, { stake: REFERENCE_STAKE });
  let guard = 0;
  while (!table.result && guard < 200) {
    guard += 1;
    const player = table.players[table.toAct];
    if (!player?.human) break;
    const action = decideAction(strengthOf(player.hole, table.board), toCall(table, player), table.pot);
    table = humanAct(table, action, prng);
  }
  return table.result ?? { multiplierBps: 0, label: 'Hand abgebrochen', detail: ['Pot 0 VC'], net: false };
}
