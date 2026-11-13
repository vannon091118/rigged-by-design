/**
 * @module num — gemeinsame Zahlenregeln fuer Spielzustand und Anzeige
 *
 * Die Modelle rundeten und klemmten bisher jeweils lokal. Eine Stelle fuer
 * Bereich, Rundung und Zahlen-Fallback haelt die Semantik gleich, ohne einen
 * zweiten Zustand einzufuehren.
 */

/** Zahl auf einen Bereich begrenzen; Standard ist der Beduerfnisbereich 0..100. */
export const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

/** Wie `clamp`, aber ganzzahlig gerundet — fuer gespeicherte Beduerfnisse. */
export const clampInt = (value: number, min = 0, max = 100): number =>
  Math.round(clamp(value, min, max));

export const round1 = (value: number): number => Math.round(value * 10) / 10;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Nur echte, endliche Zahlen zaehlen; alles andere ist der Startwert. */
export function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
