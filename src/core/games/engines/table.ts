/** Tischspiele: Roulette mit voller Wettfläche, zwei Wuerfel, Huetchenspiel mit Serie. */
import type { Prng } from '../../rng/prng';
import { DICE_PAYOUTS, diceBetWins, type DiceBetKind } from '../dice-bets';

interface TableOutcome {
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
  /** Wuerfel: die beiden Augen, damit die Buehne genau die zeigt. */
  readonly dice?: readonly [number, number];
}

// ---------------------------------------------------------------- Roulette

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type RouletteBet =
  | { readonly kind: 'STRAIGHT'; readonly number: number }
  | { readonly kind: 'SPLIT'; readonly a: number; readonly b: number }
  | { readonly kind: 'STREET'; readonly row: number }
  | { readonly kind: 'CORNER'; readonly corner: number }
  | { readonly kind: 'SIXLINE'; readonly row: number }
  | { readonly kind: 'DOZEN'; readonly index: 1 | 2 | 3 }
  | { readonly kind: 'COLUMN'; readonly index: 1 | 2 | 3 }
  | { readonly kind: 'RED' } | { readonly kind: 'BLACK' }
  | { readonly kind: 'EVEN' } | { readonly kind: 'ODD' }
  | { readonly kind: 'LOW' } | { readonly kind: 'HIGH' };

/** Auszahlung in Basispunkten des Einsatzes je Wettart (European Wheel). */
const ROULETTE_PAYOUTS: Readonly<Record<RouletteBet['kind'], number>> = {
  STRAIGHT: 360_000, SPLIT: 180_000, STREET: 120_000,
  CORNER: 90_000, SIXLINE: 60_000, DOZEN: 30_000, COLUMN: 30_000,
  // Hauskonfiguration: 1,95x statt 2x auf einfache Chancen haelt den RTP bei 94,9 %.
  RED: 19_500, BLACK: 19_500, EVEN: 19_500, ODD: 19_500, LOW: 19_500, HIGH: 19_500,
};

function covers(bet: RouletteBet, number: number): boolean {
  switch (bet.kind) {
    case 'STRAIGHT': return number === bet.number;
    case 'SPLIT': return number === bet.a || number === bet.b;
    case 'STREET': return number >= bet.row * 3 + 1 && number <= bet.row * 3 + 3;
    case 'CORNER': return [bet.corner, bet.corner + 1, bet.corner + 3, bet.corner + 4].includes(number);
    case 'SIXLINE': return number >= bet.row * 6 + 1 && number <= bet.row * 6 + 6;
    case 'DOZEN': return Math.ceil(number / 12) === bet.index;
    case 'COLUMN': return number !== 0 && (number - 1) % 3 === bet.index - 1;
    case 'RED': return RED.has(number);
    case 'BLACK': return number !== 0 && !RED.has(number);
    case 'EVEN': return number !== 0 && number % 2 === 0;
    case 'ODD': return number % 2 === 1;
    case 'LOW': return number >= 1 && number <= 18;
    case 'HIGH': return number >= 19 && number <= 36;
    default: return false;
  }
}

export function spinRoulette(prng: Prng, bet: RouletteBet): TableOutcome & { readonly number: number } {
  const number = prng.nextInt(0, 36);
  const win = covers(bet, number);
  const multiplierBps = win ? ROULETTE_PAYOUTS[bet.kind] : 0;
  const colour = number === 0 ? 'gruen' : RED.has(number) ? 'rot' : 'schwarz';
  return {
    number,
    multiplierBps,
    label: win ? `${number} ${colour} - gewonnen` : `${number} ${colour} - verloren`,
    detail: [`${number}`, colour, `Satz: ${bet.kind}`],
  };
}

// ---------------------------------------------------------------- Wuerfel

type DiceBet = { readonly kind: DiceBetKind };

export function rollDice(prng: Prng, bet: DiceBet): TableOutcome {
  const a = prng.nextInt(1, 6);
  const b = prng.nextInt(1, 6);
  const sum = a + b;
  const win = diceBetWins(bet.kind, a, b);
  const multiplierBps = win ? DICE_PAYOUTS[bet.kind] : 0;
  return {
    multiplierBps,
    label: `${a}+${b}=${sum} ${win ? 'gewinnt' : 'verliert'}`,
    detail: [`${a}`, `${b}`, `Satz: ${bet.kind}`],
    dice: [a, b],
  };
}

// ---------------------------------------------------------------- Huetchen

/**
 * Kugel, Mischfolge und Wahl: der Operator legt die Kugel, die Mischfolge ist
 * eine echte Permutation aus dem PRNG, danach raet der Spieler Position 0.
 */
export function playShell(prng: Prng, series: 1 | 3 | 5 = 1): TableOutcome {
  const needed = Math.ceil(series / 2);
  let wins = 0;
  let losses = 0;
  const trace: string[] = [];
  while (wins < needed && losses < needed) {
    const ball = prng.nextInt(0, 2);
    const order = [0, 1, 2];
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = prng.nextInt(0, index);
      const value = order[index]!;
      order[index] = order[swap]!;
      order[swap] = value;
    }
    const guess = 0;
    const win = ball === guess;
    if (win) wins += 1; else losses += 1;
    trace.push(win ? '●' : '·');
  }
  const games = wins + losses;
  const perGame = 28_500;
  // Gesamteinsatz ist ein Einsatz je Spiel; die Quote bezieht sich darauf.
  const multiplierBps = Math.round((wins * perGame) / games);
  return {
    multiplierBps,
    label: wins > losses ? `Serie gewonnen ${wins}:${losses}` : `Serie verloren ${wins}:${losses}`,
    detail: trace,
  };
}
