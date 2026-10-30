/** Dispatcher: jedes Spiel hat seine eigene Engine, alle liefern dieselbe Ergebnisform. */
import type { GameId } from '../sim/types';
import type { Prng } from '../rng/prng';
import { playBlackjack, playVideoPoker } from './engines/cards';
import { playSlot, type SlotLineWin } from './engines/slot';
import { playShell, rollDice, spinRoulette } from './engines/table';
import type { DiceBetKind } from './dice-bets';
import { spinRouletteTable, type RouletteChip, type RouletteSpin } from './roulette-table';
import { resolveShellPick, type ShellRound } from './shell-round';
import { createPlinkoBoard, PLINKO_POCKETS } from './plinko-board';
import { plinkoPaytable, type PlinkoDrop } from './plinko-config';

interface RoundOptions {
  readonly variant?: DiceBetKind;
  readonly captureTrack?: boolean;
  readonly roulette?: readonly RouletteChip[];
  readonly shell?: { readonly round: ShellRound; readonly pick: number };
}

interface RoundResult {
  readonly game: GameId;
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
  /** Nur fuer Spiele mit Gitter: vollstaendige Walzenlage fuer die Anzeige. */
  readonly grid?: readonly (readonly string[])[];
  readonly wins?: readonly SlotLineWin[];
  readonly books?: number;
  readonly drop?: PlinkoDrop;
  readonly dice?: readonly [number, number];
  readonly roulette?: RouletteSpin;
}

/** Paytable auf die gemessene Fachverteilung des Boards geeicht (~93 % RTP). */
const PLINKO_PAYOUT_BPS = plinkoPaytable(PLINKO_POCKETS);
const plinkoBoard = createPlinkoBoard();

function plinko(prng: Prng, captureTrack = false): RoundResult {
  const drop = plinkoBoard.drop(prng, 'SINGLE', captureTrack);
  const pocket = drop.pockets[0] ?? 0;
  const bps = PLINKO_PAYOUT_BPS[pocket] ?? 0;
  return {
    game: 'PLINKO',
    multiplierBps: bps,
    label: `Fach ${pocket + 1} - ${(bps / 10_000).toFixed(2).replace('.', ',')}x`,
    detail: ['●', `${pocket + 1}/${PLINKO_POCKETS}`, `${drop.steps} Schritte`],
    drop: captureTrack ? drop : undefined,
  };
}

/** Standard-Satz je Spiel, solange der Spieler keine eigene Wettart waehlt. */
export function playRound(game: GameId, prng: Prng, options: RoundOptions = {}): RoundResult {
  if (game === 'BLACKJACK') return { game, ...playBlackjack(prng) };
  if (game === 'POKER') return { game, ...playVideoPoker(prng) };
  if (game === 'ROULETTE') {
    if (!options.roulette?.length) {
      const outcome = spinRoulette(prng, { kind: 'RED' });
      return { game, multiplierBps: outcome.multiplierBps, label: outcome.label, detail: outcome.detail };
    }
    const spin = spinRouletteTable(prng, options.roulette);
    return {
      game,
      multiplierBps: spin.multiplierBps,
      label: `${spin.number} ${spin.colour}`,
      detail: [String(spin.number), spin.colour, `${spin.hits.length} Treffer`],
      roulette: spin,
    };
  }
  if (game === 'PLINKO') return plinko(prng, options.captureTrack ?? false);
  if (game === 'SHELL') {
    if (!options.shell) return { game, ...playShell(prng) };
    const pick = resolveShellPick(options.shell.round, options.shell.pick);
    return {
      game,
      multiplierBps: pick.multiplierBps,
      label: pick.label,
      detail: [`Becher ${options.shell.pick + 1}`, pick.won ? 'Perle' : 'leer'],
    };
  }
  if (game === 'DICE') return { game, ...rollDice(prng, { kind: options.variant ?? 'OVER' }) };
  return { game: 'SLOT', ...playSlot(prng) };
}
