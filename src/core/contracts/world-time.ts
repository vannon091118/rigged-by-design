/**
 * Contract: world-time v1.0
 * WorldTime, Calendar-Bezug und TimeDomain-Schlüssel.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

export type TimeDomain = 'gameplay' | 'presentation';

/** Dauer eines Ticks in Millisekunden. */
export const TICK_MS = 520;

/** Ticks pro Simulations-Tag. */
export const TICKS_PER_DAY = 600;

/** Berechnet den Simulations-Tag aus einem Tick. */
export function dayFromTick(tick: number): number {
  return Math.floor(tick / TICKS_PER_DAY);
}

/** Berechnet den Tick im aktuellen Tag (0-basiert). */
export function tickInDay(tick: number): number {
  return tick % TICKS_PER_DAY;
}

/** Prüft, ob ein Tick den Beginn eines neuen Tages markiert. */
export function isDayStart(tick: number): boolean {
  return tick % TICKS_PER_DAY === 0;
}

/** Erstellt einen deterministischen Zeit-Schlüssel aus Tick und TimeDomain. */
export function timeKey(tick: number, domain: TimeDomain): string {
  return `${domain}:${tick}`;
}
