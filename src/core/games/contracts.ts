/** Die Naht zwischen Spielregel, Geld und Anzeige: Aktion rein, Result raus. */
import { mulVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import type { GameId } from '../sim/types';
import type { SlotLineWin } from './engines/slot';
import { playRound } from './round';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];
const MAX_ADJUST_BPS = 9_000;

interface GameAction {
  readonly game: GameId;
  /** Einsatz in Mikro-VC. 0 ist der freie Testspin am eigenen Automaten. */
  readonly stake: VaCoinMicro;
  /** Hausvorteil eines fremden Hauses in Basispunkten. */
  readonly houseEdgeBps?: number;
  /** Aufschlag der Maschine aus ihren Mods, z. B. CHERRY. */
  readonly bonusBps?: number;
}

export interface GameResult {
  readonly game: GameId;
  readonly stake: VaCoinMicro;
  readonly payout: VaCoinMicro;
  /** Netto-Quote nach Bonus und Hausvorteil; `payout` folgt daraus exakt. */
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
  /** Slot-Anzeige: volles 5x3-Gitter, bezahlte Linien und Buch-Zaehler. */
  readonly grid?: readonly (readonly string[])[];
  readonly wins?: readonly SlotLineWin[];
  readonly books?: number;
}

function assertAdjust(value: number | undefined, label: string): void {
  const bps = value ?? 0;
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > MAX_ADJUST_BPS) {
    throw new Error(`${label} ${bps} liegt ausserhalb 0..${MAX_ADJUST_BPS}`);
  }
}

/**
 * Die einzige erlaubte Steuerung einer Runde. Alles, was nicht durch diese Pruefung
 * kommt, kostet keinen Zufall und bewegt kein Geld.
 */
export function playAction(action: GameAction, prng: Prng): GameResult {
  const { game, stake, houseEdgeBps, bonusBps } = action;
  if (!GAMES.includes(game)) throw new Error(`Unbekanntes Spiel: ${String(game)}`);
  if (!Number.isSafeInteger(stake) || stake < 0) {
    throw new Error(`Einsatz ${String(stake)} ist keine gueltige Mikro-Summe`);
  }
  assertAdjust(houseEdgeBps, 'houseEdgeBps');
  assertAdjust(bonusBps, 'bonusBps');
  const roll = playRound(game, prng);
  // Ein Verlust bleibt ein Verlust: Bonus und Hausvorteil greifen nur auf Gewinne.
  const multiplierBps = roll.multiplierBps > 0
    ? Math.max(0, roll.multiplierBps + (bonusBps ?? 0) - (houseEdgeBps ?? 0))
    : 0;
  return {
    game,
    stake,
    payout: mulVC(stake, multiplierBps),
    multiplierBps,
    label: roll.label,
    detail: roll.detail,
    grid: roll.grid,
    wins: roll.wins,
    books: roll.books,
  };
}
