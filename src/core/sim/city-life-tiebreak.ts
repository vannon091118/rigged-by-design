/**
 * @module city-life-tiebreak — seedfester Gleichstand
 *
 * Der Score ist deterministisch; nur nahe Gleichstände bekommen eine kleine,
 * reproduzierbare Verschiebung aus Seed, NPC und Tick. Sie ist bewusst kleiner
 * als jeder Sachfaktor und wird im Trace als eigener Umgebungsfaktor geführt.
 */
import { round2 } from './num';

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/**
 * Breite des Tie-Breaks in Hundertstelpunkten. ±0.35 lag unter fast jedem
 * echten Abstand und machte den Seed unsichtbar; ±3 bricht nur Near-Ties und
 * bleibt kleiner als Routine, Beduerfnis und Beziehung. Jede Verschiebung
 * steht als eigener Faktor im Trace, damit die Entscheidung nachvollziehbar
 * bleibt statt zufaellig zu wirken.
 */
const TILT_CENTS = 300;

/** Seedfester Tie-Break: gleiche Eingabe, gleiche Entscheidung. */
export function seedTilt(seed: number, npcId: string, tick: number): number {
  if (seed === 0) return 0;
  const raw = hash(`${seed}:${npcId}:${tick}`) % (TILT_CENTS * 2 + 1);
  return round2((raw - TILT_CENTS) / 100);
}
