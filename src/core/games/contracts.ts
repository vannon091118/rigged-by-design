/** Die Naht zwischen Spielregel, Geld und Anzeige: Aktion rein, Result raus. */
import { mulVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import type { GameId } from '../sim/types';
import { DICE_BETS, type DiceBetKind } from './dice-bets';
import type { SlotLineWin } from './engines/slot';
import type { PlinkoDrop } from './plinko-config';
import { spotInfo, totalStake, type RouletteChip, type RouletteSpin } from './roulette-table';
import type { ShellRound } from './shell-round';
import { playRound } from './round';

const DICE_KINDS = new Set<string>(DICE_BETS.map((bet) => bet.id));

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
  /** Gewaehltes Wettfeld am Wuerfeltisch; ohne Angabe gilt "ueber 7". */
  readonly variant?: DiceBetKind;
  /** Plinko: die Physikbahn fuer die Buehne mitliefern. */
  readonly captureTrack?: boolean;
  /** Roulette: die Jetons des Teppichs; der Einsatz ist ihre Summe. */
  readonly roulette?: readonly RouletteChip[];
  /** Huetchen: die vorbereitete Runde und die Wahl des Spielers. */
  readonly shell?: { readonly round: ShellRound; readonly pick: number };
}

/** Alles, was eine Runde zusaetzlich zum Einsatz braucht; dieselbe Form ueberall. */
export type GameExtras = Pick<GameAction, 'variant' | 'captureTrack' | 'roulette' | 'shell'>;

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
  /** Plinko: Taschen und Bahnen des gefallenen Balls. */
  readonly drop?: PlinkoDrop;
  /** Wuerfel: die beiden Augen des Wurfs. */
  readonly dice?: readonly [number, number];
  /** Roulette: gezogene Zahl, Farbe und die gedeckten Jetons. */
  readonly roulette?: RouletteSpin;
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
  if (action.variant !== undefined && !DICE_KINDS.has(action.variant)) {
    throw new Error(`Unbekanntes Wettfeld: ${String(action.variant)}`);
  }
  for (const chip of action.roulette ?? []) {
    if (!spotInfo(chip.spot) || !Number.isSafeInteger(chip.stake) || chip.stake <= 0) {
      throw new Error(`Ungueltiger Jeton auf ${String(chip.spot)}`);
    }
  }
  if (action.roulette && action.roulette.length > 0 && totalStake(action.roulette) !== stake) {
    throw new Error(`Einsatz ${stake} passt nicht zu den Jetons (${totalStake(action.roulette)})`);
  }
  const roll = playRound(game, prng, {
    variant: action.variant,
    captureTrack: action.captureTrack,
    roulette: action.roulette,
    shell: action.shell,
  });
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
    drop: roll.drop,
    dice: roll.dice,
    roulette: roll.roulette,
  };
}
