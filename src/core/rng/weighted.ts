/**
 * Weighted random selection with bias correction.
 *
 * MAX_BIAS_BPS = 1000 basis points = 10% maximum bias.
 * Correct formula: max_multiplier = 1 + (MAX_BIAS_BPS / 10000) = 1 + 0.10 = 1.10×
 * (NOT "10.99×" — that was a documentation error.)
 */

export const MAX_BIAS_BPS = 1000;

export interface WeightedOption<T> {
  readonly value: T;
  readonly weight: number; // basis points, 0..10000
  readonly biasBps?: number; // optional bias adjustment, -MAX_BIAS_BPS..MAX_BIAS_BPS
}

export function selectWeighted<T>(options: WeightedOption<T>[]): T {
  if (options.length === 0) throw new Error("No options to select from");

  let totalWeight = 0;
  for (const o of options) {
    const w = Math.max(0, o.weight + (o.biasBps ?? 0));
    totalWeight += w;
  }

  if (totalWeight <= 0) {
    // Fallback: uniform selection
    return options[Math.floor(Math.random() * options.length)].value;
  }

  const r = Math.random() * totalWeight;
  let accumulator = 0;
  for (const o of options) {
    const w = Math.max(0, o.weight + (o.biasBps ?? 0));
    accumulator += w;
    if (r < accumulator) return o.value;
  }

  return options[options.length - 1].value;
}

export function maxBiasMultiplier(): number {
  return 1 + MAX_BIAS_BPS / 10000; // = 1.10×
}