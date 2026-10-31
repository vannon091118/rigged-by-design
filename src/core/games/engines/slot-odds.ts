/**
 * Chancen-Kalibrierung des Slots: wie viel eine Walzenanzahl auszahlt.
 *
 * Die Erwartungswerte werden exakt ueber alle Symbolfolgen ausgerechnet und
 * um die erwarteten Freispiele ergaenzt. Daraus folgt die Skalierung, mit der
 * drei, vier und fuenf Walzen denselben Ertrag liefern. Was die Walzenzahl
 * also wirklich veraendert, sind moegliche Kombinationen, Trefferbild und
 * Streuung – nicht der Hausvorteil.
 */
import {
  BASE_SCALE, clampedReels, FREE_SPINS, LINE_PAY, P_BOOK, SLOT_ROWS, SLOT_SYMBOLS,
  WEIGHTS, WEIGHT_TOTAL, type SlotSymbol,
} from './slot-paytable';

function binom(n: number, k: number): number {
  let value = 1;
  for (let step = 0; step < k; step += 1) value = (value * (n - step)) / (step + 1);
  return value;
}

/** Chance, in einem vollstaendigen Gitter mindestens drei Buecher zu sehen. */
function triggerChance(reels: number): number {
  const cells = reels * SLOT_ROWS;
  let below = 0;
  for (let count = 0; count <= 2; count += 1) {
    below += binom(cells, count) * P_BOOK ** count * (1 - P_BOOK) ** (cells - count);
  }
  return Math.max(1e-9, 1 - below);
}

/** Durchschnittliche Dreier bis zum naechsten Jackpot dieser Walzenanzahl. */
export function slotJackpotInterval(reels: number): number {
  return Math.round(1 / triggerChance(clampedReels(reels)));
}

/** Erwartungswert einer Linie vor Skalierung: exakt ueber alle Symbolfolgen. */
function lineExpectation(reels: number): number {
  let total = 0;
  const trail: SlotSymbol[] = new Array(reels);
  const walk = (index: number, prob: number): void => {
    if (index === reels) {
      const lead = trail.find((symbol) => symbol !== 'BOOK') ?? 'BOOK';
      let run = 0;
      for (const symbol of trail) {
        if (symbol === lead || symbol === 'BOOK') run += 1;
        else break;
      }
      if (run >= 3) total += prob * LINE_PAY[lead][run - 3]!;
      return;
    }
    for (const symbol of SLOT_SYMBOLS) {
      trail[index] = symbol;
      walk(index + 1, (prob * WEIGHTS[symbol]) / WEIGHT_TOTAL);
    }
  };
  walk(0, 1);
  return total;
}

/** Gesamtertrag je Spin: ausloesende Linien plus die erwarteten Freispiele. */
function spinExpectation(reels: number): number {
  // Jeder Freispielzug loest mit derselben Chance zehn weitere aus,
  // deshalb gilt R = 10 / (1 - 10t) und nicht 10 / (1 - t).
  const trigger = Math.min(0.09, triggerChance(reels));
  const rounds = FREE_SPINS / Math.max(1e-6, 1 - FREE_SPINS * trigger);
  return lineExpectation(reels) * (1 + rounds);
}

const EXPECTATION: Readonly<Record<number, number>> = {
  3: spinExpectation(3),
  4: spinExpectation(4),
  5: spinExpectation(5),
};

/**
 * Skalierung einer Walzenanzahl: derselbe Ertrag wie bei fuenf Walzen.
 * Mehr Walzen bedeuten dadurch mehr Kombinationen bei gleichem Hausvorteil.
 */
export function payScaleFor(reels: number): number {
  const clamped = clampedReels(reels);
  return (EXPECTATION[5]! * BASE_SCALE) / (EXPECTATION[clamped] ?? EXPECTATION[5]!);
}
