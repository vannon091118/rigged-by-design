/** Dispatcher: jedes Spiel hat seine eigene Engine, alle liefern dieselbe Ergebnisform. */
import type { GameId } from '../sim/types';
import type { Prng } from '../rng/prng';
import { playBlackjack, playVideoPoker } from './engines/cards';
import { playSlot, type SlotLineWin } from './engines/slot';
import { playShell, rollDice, spinRoulette } from './engines/table';
import type { DiceBetKind } from './dice-bets';
import { createPlinkoBoard, PLINKO_POCKETS } from './plinko-board';
import { plinkoPaytable, type PlinkoDrop } from './plinko-config';

interface RoundOptions {
  readonly variant?: DiceBetKind;
  readonly captureTrack?: boolean;
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
    const outcome = spinRoulette(prng, { kind: 'RED' });
    return { game, multiplierBps: outcome.multiplierBps, label: outcome.label, detail: outcome.detail };
  }
  if (game === 'PLINKO') return plinko(prng, options.captureTrack ?? false);
  if (game === 'SHELL') return { game, ...playShell(prng) };
  if (game === 'DICE') return { game, ...rollDice(prng, { kind: options.variant ?? 'OVER' }) };
  return { game: 'SLOT', ...playSlot(prng) };
}
