/**
 * Chancen-Kalibrierung des Slots: wie viel eine Walzenanzahl auszahlt.
 *
 * Die Skalierung normalisiert jedes Bewertungsmodell auf denselben Ertrag bei
 * fuenf Walzen. Was die Walzenzahl wirklich veraendert, sind Kombinationen,
 * Trefferbild und Streuung – nicht der Hausvorteil.
 */
import { BASE_SCALE, clampedReels, FREE_SPINS, WEIGHTS, weightTotal, type SlotWeights } from './slot-paytable';
import { modelExpectation, type PayModel, type Volatility } from './slot-models';

function binom(n: number, k: number): number {
  let value = 1;
  for (let step = 0; step < k; step += 1) value = (value * (n - step)) / (step + 1);
  return value;
}

/** Chance, dass genug Scatter fuer den Bonus im Gitter liegen. */
export function triggerChance(reels: number, weights: SlotWeights = WEIGHTS, need = 3): number {
  const total = weightTotal(weights);
  const p = total > 0 ? Math.max(0, weights.BOOK) / total : 0;
  const cells = clampedReels(reels) * 3;
  let below = 0;
  for (let count = 0; count < need; count += 1) {
    below += binom(cells, count) * p ** count * (1 - p) ** (cells - count);
  }
  return Math.max(1e-9, 1 - below);
}

/** Durchschnittliche Dreier bis zum naechsten Bonus dieser Walzenanzahl. */
export function slotJackpotInterval(reels: number, weights: SlotWeights = WEIGHTS): number {
  return Math.round(1 / triggerChance(clampedReels(reels), weights));
}

/**
 * Erwartete Freispielzuege JE SPIN – nicht je Ausloesung. Die Ausloesung ist selten,
 * ihre Kette dagegen zehn Zuege lang; beides gehoert in dieselbe Zahl.
 */
export function freeRounds(chance: number, spins = FREE_SPINS): number {
  const trigger = Math.min(0.09, chance);
  return (trigger * spins) / Math.max(1e-6, 1 - spins * trigger);
}

interface ScaleOptions {
  readonly model?: PayModel;
  readonly volatility?: Volatility;
  readonly payScaleBps?: number;
}

/**
 * Skalierung einer Walzenanzahl: jedes Modell wird auf denselben Ertrag bei fuenf
 * Walzen normalisiert; das Auszahlungsprofil ist danach ein reiner Faktor.
 */
export function payScaleFor(reels: number, weights: SlotWeights = WEIGHTS, options: ScaleOptions = {}): number {
  const model = options.model ?? 'LINES';
  const volatility = options.volatility ?? 'MID';
  const factor = (options.payScaleBps ?? 10_000) / 10_000;
  const clamped = clampedReels(reels);
  // Anker ist das Linienmodell bei fuenf Walzen – darauf ist BASE_SCALE kalibriert.
  // Die Freispiel-Faktoren stehen auf beiden Seiten, sonst zahlt jede Walzenzahl anders.
  const anchor = modelExpectation('LINES', 5, weights, true, 'MID') * (1 + freeRounds(triggerChance(5, weights)));
  const target = modelExpectation(model, clamped, weights, true, volatility) * (1 + freeRounds(triggerChance(clamped, weights)));
  return ((anchor * BASE_SCALE) / Math.max(1e-9, target)) * factor;
}
