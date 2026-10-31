/** Rundenpoker am Tisch: vier Spieler, je Strasse eine Setzrunde, Pot für alle. */
import type { Prng } from '../rng/prng';
import { createShoe, type Card, type CardShoe } from '../rng/shoe';
import { endHand, settleShowdown } from './poker-settle';
import { decideAction, strengthOf, type PokerAction } from './poker-strategy';
import type { PokerHandOptions, PokerPlayer, PokerTable, PokerStreet } from './poker-types';

/** Nach drei Erhoehungen in einer Strasse ist Schluss; all-in zählt nicht als Erhoehung. */
const MAX_RAISES = 3;
/** Gaststapel als Vielfaches des Buy-ins; unterschiedliche Stapel erzeugen Side Pots. */
const CPU_STACKS = [3, 2, 1] as const;
const DEAL: Readonly<Record<PokerStreet, number>> = { PREFLOP: 3, FLOP: 1, TURN: 1, RIVER: 0, SHOWDOWN: 0 };
const NEXT: Readonly<Record<PokerStreet, PokerStreet>> = {
  PREFLOP: 'FLOP', FLOP: 'TURN', TURN: 'RIVER', RIVER: 'SHOWDOWN', SHOWDOWN: 'SHOWDOWN',
};

export function toCall(table: PokerTable, player: PokerPlayer): number {
  return Math.max(0, table.bet - player.committed);
}

/** Neue Hand: Ante von jedem, zwei Karten je Spieler, der Spieler beginnt. */
export function startHand(prng: Prng, options: PokerHandOptions): PokerTable {
  const opponents = Math.min(CPU_STACKS.length, Math.max(1, options.opponents ?? CPU_STACKS.length));
  const { stake } = options;
  if (!Number.isSafeInteger(stake) || stake < 4) throw new Error(`Poker-Einsatz ${String(stake)} ist ungueltig`);
  const unit = Math.max(1, Math.floor(stake / 4));
  const shoe: CardShoe = createShoe(prng);
  const deal = (): readonly Card[] => [shoe.draw(), shoe.draw()];
  const players: PokerPlayer[] = [
    { id: 'DU', human: true, hole: deal(), stack: stake - unit, committed: unit, folded: false, allIn: false, acted: false },
    ...CPU_STACKS.slice(0, opponents).map((factor, index) => ({
      id: `GAST ${index + 1}`, human: false, hole: deal(),
      stack: stake * factor - unit, committed: unit, folded: false, allIn: false, acted: false,
    })),
  ];
  const table: PokerTable = {
    players, board: [], shoe, pot: unit * players.length, stake, unit,
    street: 'PREFLOP', toAct: 0, bet: 0, raises: 0, result: null,
  };
  return tick(table, prng);
}

/** Die Person am Zug spielt ihre Aktion; danach laeuft der Tisch bis zur naechsten Person. */
export function humanAct(table: PokerTable, action: PokerAction, prng: Prng): PokerTable {
  if (table.result || table.toAct < 0 || !table.players[table.toAct]!.human) return table;
  return tick(applyAction(table, table.toAct, action), prng);
}

/** CPU-Zuege bis die Person am Zug ist oder die Hand fertig ist. */
function tick(table: PokerTable, prng: Prng): PokerTable {
  let current = table;
  let guard = 0;
  while (!current.result && guard < 400) {
    guard += 1;
    const actor = current.toAct;
    if (actor < 0) return current;
    const player = current.players[actor]!;
    if (player.human) return current;
    const action = decideAction(strengthOf(player.hole, current.board), toCall(current, player), current.pot, prng);
    current = applyAction(current, actor, action);
  }
  return current;
}

function commit(player: PokerPlayer, amount: number): void {
  const pay = Math.max(0, Math.min(amount, player.stack));
  player.stack -= pay;
  player.committed += pay;
  if (player.stack === 0) player.allIn = true;
}

function applyAction(table: PokerTable, index: number, action: PokerAction): PokerTable {
  const players = table.players.map((player) => ({ ...player }));
  const me = players[index]!;
  const call = Math.max(0, table.bet - me.committed);
  const cap = me.committed + me.stack;
  // CHECK ohne Stehen geht als Call; eine Erhoehung wird begrenzt und kann leer laufen.
  const target = action === 'CHECK' && call > 0 ? cap : action === 'RAISE'
    ? (table.raises < MAX_RAISES
      ? Math.max(Math.min(table.bet + table.unit, cap), Math.min(table.bet, cap))
      : Math.min(table.bet, cap))
    : me.committed;
  if (action === 'FOLD') me.folded = true;
  else if (action === 'CHECK' && call === 0) me.acted = true;
  else {
    commit(me, Math.max(0, target - me.committed));
    me.acted = true;
  }
  let bet = table.bet;
  let raises = table.raises;
  if (!me.folded && me.committed > bet) {
    bet = me.committed;
    raises += 1;
    // Eine Erhoehung oeffnet die Runde fuer alle anderen neu.
    for (const player of players) {
      if (player !== me && !player.folded && !player.allIn) player.acted = false;
    }
  }
  const pot = players.reduce((sum, player) => sum + player.committed, 0);
  return reflow({ ...table, players, pot, bet, raises }, index);
}

function needsAction(table: PokerTable): boolean {
  return table.players.some((player) => !player.folded && !player.allIn && (!player.acted || player.committed < table.bet));
}

function nextActor(table: PokerTable, from: number): number {
  const count = table.players.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (from + step + count) % count;
    const player = table.players[index]!;
    if (!player.folded && !player.allIn && (!player.acted || player.committed < table.bet)) return index;
  }
  return -1;
}

/** Nach jeder Aktion: Handende, Strassenwechsel oder der naechste Spieler. */
function reflow(table: PokerTable, actor: number): PokerTable {
  const alive = table.players.filter((player) => !player.folded).length;
  if (alive <= 1) return endHand(table);
  if (needsAction(table)) {
    const next = nextActor(table, actor);
    if (next >= 0) return { ...table, toAct: next };
    return settleShowdown(table);
  }
  return dealStreet(table);
}

function dealStreet(table: PokerTable): PokerTable {
  let board = table.board;
  for (let index = 0; index < DEAL[table.street]; index += 1) board = [...board, table.shoe.draw()];
  const street = NEXT[table.street];
  const players = table.players.map((player) => ({ ...player, acted: false }));
  const base: PokerTable = { ...table, board, players, street, bet: 0, raises: 0, toAct: -1 };
  if (street === 'SHOWDOWN') return settleShowdown(base);
  if (!players.some((player) => !player.folded && !player.allIn)) return dealStreet(base);
  const first = nextActor(base, -1);
  return first < 0 ? settleShowdown(base) : { ...base, toAct: first };
}
