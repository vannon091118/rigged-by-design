/**
 * Chancen-Kalibrierung des Slots: wie viel eine Walzenanzahl auszahlt.
 *
 * Alle Erwartungswerte werden exakt ueber alle Symbolfolgen einer Linie
 * ausgerechnet – mit derselben `lineWin`-Funktion, die die Engine benutzt.
 * Die Skalierung normalisiert drei, vier und fuenf Walzen auf denselben Ertrag;
 * was die Walzenzahl wirklich veraendert, sind Kombinationen, Trefferbild und
 * Streuung, nicht der Hausvorteil.
 */
import {
  BASE_SCALE, clampedReels, FREE_SPINS, SLOT_ROWS, SLOT_SYMBOLS, WEIGHTS, lineWin, weightTotal,
  type SlotSymbol, type SlotWeights,
} from './slot-paytable';

function binom(n: number, k: number): number {
  let value = 1;
  for (let step = 0; step < k; step += 1) value = (value * (n - step)) / (step + 1);
  return value;
}

/** Chance, in einem vollstaendigen Gitter mindestens drei Buecher zu sehen. */
export function triggerChance(reels: number, weights: SlotWeights = WEIGHTS): number {
  const total = weightTotal(weights);
  const p = total > 0 ? Math.max(0, weights.BOOK) / total : 0;
  const cells = clampedReels(reels) * SLOT_ROWS;
  let below = 0;
  for (let count = 0; count <= 2; count += 1) {
    below += binom(cells, count) * p ** count * (1 - p) ** (cells - count);
  }
  return Math.max(1e-9, 1 - below);
}

/** Durchschnittliche Dreier bis zum naechsten Jackpot dieser Walzenanzahl. */
export function slotJackpotInterval(reels: number, weights: SlotWeights = WEIGHTS): number {
  return Math.round(1 / triggerChance(clampedReels(reels), weights));
}

/**
 * Erwartete Freispielzuege JE SPIN – nicht je Ausloesung. Die Ausloesung ist selten,
 * ihre Kette dagegen zehn Zuege lang; beides gehoert in dieselbe Zahl, sonst
 * zaehlt die Quote die Freispiele zehnmal.
 */
export function freeRounds(chance: number): number {
  const trigger = Math.min(0.09, chance);
  return (trigger * FREE_SPINS) / Math.max(1e-6, 1 - FREE_SPINS * trigger);
}

interface LineOdds {
  /** Erwartungswert einer Linie in Basispunkten des Linieneinsatzes. */
  readonly expectation: number;
  /** Chance in Basispunkten, dass diese Linie ueberhaupt zahlt. */
  readonly hitBps: number;
}

const LINE_CACHE = new Map<string, LineOdds>();

function weightsKey(weights: SlotWeights): string {
  return SLOT_SYMBOLS.map((symbol) => Math.max(0, weights[symbol])).join(',');
}

/**
 * Exakt ueber alle Symbolfolgen einer Linie. `scale` gehoert in den Cache-Schluessel,
 * weil die Engine jeden Liniengewinn auf ganze Basispunkte rundet.
 */
export function lineOdds(reels: number, weights: SlotWeights = WEIGHTS, wild = true, scale = 1): LineOdds {
  const key = `${reels}:${wild ? 1 : 0}:${scale}:${weightsKey(weights)}`;
  const cached = LINE_CACHE.get(key);
  if (cached) return cached;
  const total = weightTotal(weights);
  const trail: SlotSymbol[] = new Array(reels);
  let expectation = 0;
  let hits = 0;
  const walk = (index: number, prob: number): void => {
    if (index === reels) {
      const hit = lineWin(trail, scale, wild);
      if (hit) {
        expectation += prob * hit.bps;
        hits += prob;
      }
      return;
    }
    for (const symbol of SLOT_SYMBOLS) {
      const weight = Math.max(0, weights[symbol]);
      if (weight <= 0) continue;
      trail[index] = symbol;
      walk(index + 1, (prob * weight) / total);
    }
  };
  if (total > 0) walk(0, 1);
  const result: LineOdds = { expectation, hitBps: hits * 10_000 };
  LINE_CACHE.set(key, result);
  return result;
}

/**
 * Skalierung einer Walzenanzahl: derselbe Ertrag wie bei fuenf Walzen.
 * Die Normalisierung rechnet immer mit Wild und Freispielen, damit der
 * Auszahlungsfaktor ein reines Walzenmaß bleibt; Regeln wirken darueber.
 */
export function payScaleFor(reels: number, weights: SlotWeights = WEIGHTS, payScaleBps = 10_000): number {
  const clamped = clampedReels(reels);
  const reference = lineOdds(5, weights, true, 1).expectation * (1 + freeRounds(triggerChance(5, weights)));
  const target = lineOdds(clamped, weights, true, 1).expectation * (1 + freeRounds(triggerChance(clamped, weights)));
  const scale = (reference * BASE_SCALE) / Math.max(1e-9, target);
  return scale * (payScaleBps / 10_000);
}
