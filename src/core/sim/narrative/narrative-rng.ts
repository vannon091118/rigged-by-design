/** Eigener Mulberry32-Strom fuer narrative Auswahl; nie der Gameplay-PRNG. */
import type { NarrativeRngState } from './event-types';

export const DEFAULT_NARRATIVE_SEED = 0x9e3779b9;

const uint32 = (value: number): number => Math.floor(value) >>> 0;

export function createNarrativeRng(seed = DEFAULT_NARRATIVE_SEED): NarrativeRngState {
  const value = Number.isFinite(seed) ? uint32(seed) : DEFAULT_NARRATIVE_SEED;
  return { seed: value, state: value };
}

/** Ein Schritt, ohne den uebergebenen Zustand zu veraendern. */
export function nextNarrativeRandom(rng: NarrativeRngState): { readonly rng: NarrativeRngState; readonly value: number } {
  const state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { rng: { seed: rng.seed, state }, value };
}

/** Gleichverteilter Index fuer Fairness-Ties; count <= 0 liefert 0 ohne Draw. */
export function narrativeIndex(rng: NarrativeRngState, count: number): { readonly rng: NarrativeRngState; readonly index: number } {
  if (!Number.isSafeInteger(count) || count <= 1) return { rng, index: 0 };
  const draw = nextNarrativeRandom(rng);
  return { rng: draw.rng, index: Math.floor(draw.value * count) };
}
