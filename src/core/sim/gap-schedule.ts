/**
 * Ankunftsluecke mit Eichung: Das Klemmen der Exponentialverteilung schneidet
 * die oberen Intervalle ab und wuerde den Laden schneller befuellen, als die
 * angezeigte Nachfrage verspricht. Der Erwartungswert der geklemmten
 * Verteilung soll genau der Zielrate folgen, deshalb loest calibratedGapMean
 * das Basismittel dazu nach.
 */
import type { Prng } from '../rng/prng';

export const MIN_GAP = 4;
/** Gegen den minutenlangen Stillstand: Wort bei voller Nachfrage, kein Gap ueber 90 Ticks. */
export const MAX_GAP = 90;

/**
 * E[min(cap, max(MIN_GAP, Exp(mittel)))] in geschlossener Form. Mit
 * cap = Infinity (Math.exp(-Infinity) == 0) entfaellt die obere Klemme und
 * die Verteilung folgt der reinen Exponentialverteilung mit Untergrenze.
 */
export function clampedGapMean(mittel: number, cap: number = MAX_GAP): number {
  const low = Math.exp(-MIN_GAP / mittel);
  const high = Math.exp(-cap / mittel);
  return MIN_GAP + mittel * (low - high);
}

/**
 * Mittel der Basisverteilung, dessen geklemmter Erwartungswert == Ziel ist.
 * Streng monoton steigend in mittel, darum verlaesst sich die Eichung auf
 * Bisektion mit verdoppeltem Obergrenzenlauf — auch dicht unter der Decke,
 * wo die Kurve gegen die horizonale Asymptote taegelt.
 */
export function calibratedGapMean(target: number, cap: number = MAX_GAP): number {
  const floor = MIN_GAP + 0.01;
  if (target <= clampedGapMean(floor, cap)) return floor;
  let lo = floor;
  let hi = Math.max(floor, 2 * target);
  while (clampedGapMean(hi, cap) < target && hi < 1e8) hi *= 2;
  for (let step = 0; step < 64; step += 1) {
    const mid = (lo + hi) / 2;
    if (clampedGapMean(mid, cap) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Rollt das Intervall, dessen Erwartungswert genau der geforderte Abstand ist.
 * Bei dichtem Andrang klemmt die Decke oben; bei duenner Nachfrage waechst der
 * Zielabstand ueber die Decke hinaus und die Klemme entfaellt — sonst wuerde
 * der Clip die leere Kneipe schneller befuellen, als die Anzeige verspricht.
 */
export function rollGap(prng: Prng, targetTicks: number): number {
  const target = Math.max(1, targetTicks);
  const open = target >= MAX_GAP;
  const mittel = calibratedGapMean(target, open ? Number.POSITIVE_INFINITY : MAX_GAP);
  const roll = Math.min(0.999, Math.max(0.001, prng.nextFloat()));
  const gap = Math.round(mittel * -Math.log(1 - roll));
  return Math.max(MIN_GAP, open ? gap : Math.min(MAX_GAP, gap));
}
