/** Walzenstreifen: Ziehung und angezeigte Chance muessen aus derselben Verteilung kommen. */
import { SLOT_SYMBOLS, weightTotal, type SlotSymbol, type SlotWeights } from './slot-paytable';

interface StripSource {
  readonly weights: SlotWeights;
  readonly reelStrips: readonly (readonly SlotSymbol[])[];
}

/** Wahrscheinlichkeit je Symbol auf einer Walze: Streifen schlagen Gewichte. */
export function reelChances(profile: StripSource, reel: number): Record<SlotSymbol, number> {
  const strip = profile.reelStrips[reel] ?? profile.reelStrips[profile.reelStrips.length - 1];
  const chances = {} as Record<SlotSymbol, number>;
  if (strip && strip.length > 0) {
    for (const symbol of SLOT_SYMBOLS) chances[symbol] = 0;
    for (const symbol of strip) chances[symbol] += 1;
    for (const symbol of SLOT_SYMBOLS) chances[symbol] /= strip.length;
    return chances;
  }
  const total = weightTotal(profile.weights);
  for (const symbol of SLOT_SYMBOLS) chances[symbol] = total > 0 ? Math.max(0, profile.weights[symbol]) / total : 0;
  return chances;
}

/** Streifen aus den Gewichten: proportional gefuellt, damit Ziehung und Quote uebereinstimmen. */
export function stripsFromWeights(weights: SlotWeights, reels: number, length = 60): SlotSymbol[][] {
  const total = weightTotal(weights);
  if (total <= 0) return [];
  const strip: SlotSymbol[] = [];
  for (const symbol of SLOT_SYMBOLS) {
    const count = Math.round((Math.max(0, weights[symbol]) / total) * length);
    for (let index = 0; index < count; index += 1) strip.push(symbol);
  }
  if (strip.length === 0) return [];
  while (strip.length < length) strip.push(SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1]!);
  return Array.from({ length: Math.max(3, Math.min(5, reels)) }, () => [...strip]);
}
