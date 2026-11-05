/** Tageszeit der Buehne: rein aus dem Tick abgeleitet, nie aus der Uhr. */
import { TICKS_PER_DAY } from './demand';

export type DayPhase = 'morning' | 'evening' | 'night';

/** Drei gleiche Abschnitte: Morgen, Abend, Nacht. */
const THIRD = TICKS_PER_DAY / 3;

export function dayPhaseOf(tick: number): DayPhase {
  const phase = ((Math.floor(tick) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  if (phase < THIRD) return 'morning';
  if (phase < THIRD * 2) return 'evening';
  return 'night';
}
