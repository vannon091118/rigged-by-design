/** Abrechnung: Side Pots nach Einsatzniveaus, Hausanteil vom Pot, Endlabel. */
import { bestHand, compareRank, handName, type HandRank } from './poker-hand';
import type { PokerResult, PokerTable } from './poker-types';

/** Hausanteil je Pot: fuenf Prozent, abgerundet auf Mikro-VC. */
const RAKE_BPS = 500;

function rake(amount: number): number {
  return Math.floor((amount * RAKE_BPS) / 10_000);
}

/**
 * Jedes Einsatzniveau wird zu einem eigenen Pot: wer weniger gesetzt hat, kann
 * nur um den Teil mitspielen, den er auch eingesetzt hat. Gefoldete Chips bleiben
 * im Pot und werden unter den Ueberlebenden verteilt.
 */
export function settleShowdown(table: PokerTable): PokerTable {
  const { players } = table;
  const ranks = players.map((player) => (player.folded ? null : bestHand([...player.hole, ...table.board])));
  const levels = [...new Set(players.map((player) => player.committed))].sort((a, b) => a - b);
  const shares = players.map(() => 0);
  let pots = 0;
  let previous = 0;
  for (const level of levels) {
    const contributors = players.filter((player) => player.committed >= level);
    const amount = (level - previous) * contributors.length;
    previous = level;
    if (amount <= 0) continue;
    const eligible = contributors.filter((player) => !player.folded);
    if (eligible.length === 0) {
      // Ungerufenes Geld geht zurueck an den hoechsten Einsatz, sonst verschwindet der Pot.
      const top = players.reduce((best, player) => (player.committed > best.committed ? player : best), players[0]!);
      const backIndex = players.indexOf(top);
      shares[backIndex] = (shares[backIndex] ?? 0) + amount;
      continue;
    }
    const isTopLevel = level === levels[levels.length - 1];
    const singleEligible = eligible.length === 1 && isTopLevel;
    pots += 1;
    const net = singleEligible ? amount : amount - rake(amount);
    let best: HandRank | null = null;
    for (const player of eligible) {
      const rank = ranks[players.indexOf(player)]!;
      if (!best || compareRank(rank, best) > 0) best = rank;
    }
    const winners = eligible.filter((player) => compareRank(ranks[players.indexOf(player)]!, best!) === 0);
    const share = Math.floor(net / winners.length);
    let rest = net - share * winners.length;
    for (const winner of winners) {
      const index = players.indexOf(winner);
      const before = shares[index] ?? 0;
      if (rest > 0) {
        shares[index] = before + share + rest;
        rest = 0;
      } else {
        shares[index] = before + share;
      }
    }
  }
  return finish(table, shares, pots);
}

/** Alle ausser einem haben gefaltet: der letzte nimmt den ganzen Pot abzueglich Hausanteil. */
export function endHand(table: PokerTable): PokerTable {
  const winner = table.players.findIndex((player) => !player.folded);
  const shares = table.players.map((_, index) => (index === winner ? table.pot - rake(table.pot) : 0));
  return finish(table, shares, 1);
}

function finish(table: PokerTable, shares: readonly number[], pots: number): PokerTable {
  const human = table.players[0]!;
  const refund = Math.max(0, table.stake - human.committed);
  const payout = refund + (shares[0] ?? 0);
  const multiplierBps = Math.max(0, Math.round((payout / table.stake) * 10_000));
  const rank = human.folded || human.hole.length + table.board.length < 5 ? null : bestHand([...human.hole, ...table.board]);
  const net = payout > table.stake;
  const label = human.folded
    ? 'Aufgegeben'
    : !rank
      ? 'Hand abgebrochen'
      : net
        ? `Pot gewonnen · ${handName(rank)}`
        : payout === table.stake
          ? `Unentschieden · ${handName(rank)}`
          : `Showdown verloren · ${handName(rank)}`;
  const detail = [
    `Pot ${Math.round(table.pot / 10_000)} VC`,
    rank ? handName(rank) : 'gefaltet',
    pots > 1 ? `${pots} Pots mit Side Pot` : 'ein Pot',
  ];
  const result: PokerResult = { multiplierBps, label, detail, net };
  return { ...table, result, toAct: -1, street: 'SHOWDOWN' };
}
