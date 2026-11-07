/** Gewichtetes Zahlenziehen: Angezeigte Chance und Ziehung stammen aus derselben Verteilung. */
import type { Prng } from './prng';

/** Maximale Eingriffstaerke: das Zielgewicht steigt auf hoechstens das 10-fache. */
export const MAX_BIAS_BPS = 9_000;

interface NumberBias {
  /** Werte, die haeufiger kommen sollen. */
  readonly targets?: readonly number[];
  /** Eingriffstaerke in Basispunkten; Gewicht = 1 + strengthBps / 1000. */
  readonly strengthBps: number;
  /** Werte, die nie kommen duerfen. */
  readonly deadzones?: readonly number[];
}

interface NumberDistribution {
  readonly min: number;
  readonly max: number;
  readonly weights: readonly number[];
  /** Chance je Wert in derselben Reihenfolge wie `weights`, Summe 1. */
  readonly chances: readonly number[];
  readonly total: number;
  readonly bias: NumberBias | null;
}

interface NumberRoll {
  /** Wert, den die reine Gleichverteilung an dieser Stelle geliefert haette. */
  readonly raw: number;
  /** Wirksamer Wert nach angewendetem Bias. */
  readonly value: number;
  readonly bias: NumberBias | null;
  /** Chance genau dieses Werts, aus derselben Verteilung. */
  readonly chance: number;
}

function assertInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} ${value} liegt nicht in ${min}..${max}`);
  }
}

/**
 * Baut die Gewichte einmalig auf. Der Bias ist hart begrenzt: Zielwerte behalten
 * einen Teil ihres Gewichts, alle anderen Werte behalten Gewicht 1, deshalb
 * bleibt jede Einzelchance unter 1.
 */
export function buildDistribution(min: number, max: number, bias?: NumberBias): NumberDistribution {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
    throw new Error(`buildDistribution: ungueltiger Bereich ${min}..${max}`);
  }
  const count = max - min + 1;
  const weights: number[] = new Array(count).fill(1);
  if (bias) {
    const { targets = [], strengthBps, deadzones = [] } = bias;
    if (!Number.isSafeInteger(strengthBps) || strengthBps < 0 || strengthBps > MAX_BIAS_BPS) {
      throw new Error(`buildDistribution: strengthBps ${strengthBps} ausserhalb 0..${MAX_BIAS_BPS}`);
    }
    if (count === 1 && (targets.length > 0 || deadzones.length > 0)) {
      throw new Error('buildDistribution: Bias auf einen einzelnen Wert ist keine Manipulation');
    }
    for (const value of deadzones) {
      assertInRange(value, min, max, 'Deadzone');
      weights[value - min] = 0;
    }
    const bonus = strengthBps / 1000;
    for (const value of targets) {
      assertInRange(value, min, max, 'Ziel');
      if (weights[value - min] === 0) throw new Error(`buildDistribution: Ziel ${value} ist Deadzone`);
      weights[value - min] = 1 + bonus;
    }
    if (weights.every((weight) => weight === 0)) throw new Error('buildDistribution: keine erreichbaren Werte');
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return { min, max, weights, chances: weights.map((weight) => weight / total), total, bias: bias ?? null };
}

/** Zieht genau einen Wert; `chance` ist die Wahrscheinlichkeit dieses Werts. */
export function rollNumber(prng: Prng, dist: NumberDistribution): NumberRoll {
  const position = prng.nextFloat();
  const target = position * dist.total;
  let accumulated = 0;
  let index = 0;
  while (index < dist.weights.length - 1) {
    accumulated += dist.weights[index]!;
    if (target < accumulated) break;
    index += 1;
  }
  return {
    raw: dist.min + Math.floor(position * dist.weights.length),
    value: dist.min + index,
    bias: dist.bias,
    chance: dist.chances[index]!,
  };
}

interface Weighted<T> {
  readonly item: T;
  readonly weight: number;
}

/**
 * Zieht ein Element nach Gewicht. Ein abgelehntes Element (z. B. besetzter Platz)
 * wird uebersprungen statt die Ziehung zu wiederholen; ohne Kandidat kommt null.
 */
export function pickWeighted<T>(
  prng: Prng,
  entries: readonly Weighted<T>[],
  accept?: (item: T) => boolean,
): T | null {
  const positive = (weight: number): number => (weight > 0 ? weight : 0);
  const total = entries.reduce((sum, entry) => sum + positive(entry.weight), 0);
  if (total <= 0) return null;
  const target = prng.nextFloat() * total;
  let accumulated = 0;
  let start = entries.length - 1;
  for (let index = 0; index < entries.length; index += 1) {
    accumulated += positive(entries[index]!.weight);
    if (target < accumulated) { start = index; break; }
  }
  for (let index = start; index < entries.length; index += 1) {
    const entry = entries[index]!;
    if (positive(entry.weight) === 0) continue;
    if (!accept || accept(entry.item)) return entry.item;
  }
  return null;
}
