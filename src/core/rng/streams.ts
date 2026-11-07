/** Zwei Stroeme, zwei Namespaces: Darstellung darf den Spielzustand nie bewegen. */
import { Prng } from './prng';

/** Eigener Strom fuer Partikel, Sound und UI-Effekte; wird nie gespeichert. */
export function presentationRng(seed: number): Prng {
  return new Prng(seed, 'presentation');
}

/**
 * Der eine Entropie-Eingang: echter Zufall nur beim Anlegen eines Laufs.
 * Alles danach ist geseedet und aus dem gespeicherten Zustand wiederholbar.
 */
export function entropySeed(): number {
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error('RNG: crypto.getRandomValues fehlt; ohne echten Seed startet kein Lauf.');
  }
  const buffer = new Uint32Array(1);
  source.getRandomValues(buffer);
  return buffer[0]!;
}

/** Frischer Darstellungs-Seed aus Krypto; der Spielstrom bleibt unberuehrt. */
export function presentationSeed(): number {
  return entropySeed();
}

/** Core-Grenze: nur ein Gameplay-Strom darf Welt oder Spiele bewegen. */
export function assertGameplayRng(prng: Prng): Prng {
  if (prng.role !== 'gameplay') {
    throw new Error(`RNG: ${prng.role}-Strom darf keinen Spielzustand ziehen.`);
  }
  return prng;
}
