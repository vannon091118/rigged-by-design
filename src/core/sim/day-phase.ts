/** Tageszeit der Buehne: rein aus dem Tick abgeleitet, nie aus der Uhr. */
import { TICKS_PER_DAY } from './demand';

export type DayPhase = 'morning' | 'evening' | 'night';

/** Drei gleiche Abschnitte: Morgen, Abend, Nacht. */
export const PHASE_TICKS = TICKS_PER_DAY / 3;

/** Die Grenzen eines Tages in Ticks; 0 und `TICKS_PER_DAY` sind dieselbe Stelle. */
export const PHASE_BOUNDARIES: readonly number[] = [0, PHASE_TICKS, PHASE_TICKS * 2];

export function dayPhaseOf(tick: number): DayPhase {
  const phase = ((Math.floor(tick) % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  if (phase < PHASE_TICKS) return 'morning';
  if (phase < PHASE_TICKS * 2) return 'evening';
  return 'night';
}
