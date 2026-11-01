/** Zwei Stroeme, zwei Namespaces: Darstellung darf den Spielzustand nie bewegen. */
import { Prng } from './prng';

/** Eigener Strom fuer Partikel, Sound und UI-Effekte; wird nie gespeichert. */
export function presentationRng(seed: number): Prng {
  return new Prng(seed, 'presentation');
}

/** Frischer Darstellungs-Seed: Krypto, sonst Uhr; der Spielstrom bleibt unberuehrt. */
export function presentationSeed(): number {
  const source = globalThis.crypto;
  if (source && typeof source.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    source.getRandomValues(buffer);
    return buffer[0]!;
  }
  return Date.now() >>> 0;
}

/** Core-Grenze: nur ein Gameplay-Strom darf Welt oder Spiele bewegen. */
export function assertGameplayRng(prng: Prng): Prng {
  if (prng.role !== 'gameplay') {
    throw new Error(`RNG: ${prng.role}-Strom darf keinen Spielzustand ziehen.`);
  }
  return prng;
}
