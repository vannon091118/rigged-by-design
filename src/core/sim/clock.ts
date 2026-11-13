/**
 * @module clock — die eine Spielzeit-Rechnung
 *
 * Ein Tag hat 600 Ticks, eine Stunde 25. Die Tageskonstante und der
 * Tagesring kommen aus dem World-Time-Contract; dieses Modul ergaenzt nur die
 * Stundenrechnung. Stadt, Nachfrage und Anzeige lesen dieselbe Quelle.
 */
import { TICKS_PER_DAY, tickInDay } from '../contracts/world-time';

export { TICKS_PER_DAY, tickInDay };
export const TICKS_PER_HOUR = TICKS_PER_DAY / 24;

/** Stunde 0..23 im Tagesring; negative Stunden bleiben im selben Ring. */
export function hourOfDay(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

/** Stunde 0..23 im Tagesring; negative Ticks bleiben im selben Ring. */
export function hourOfTick(tick: number): number {
  return Math.floor(tickInDay(tick) / TICKS_PER_HOUR);
}
