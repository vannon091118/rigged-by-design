/**
 * Clubabend in der Lounge (Agent 19): Oeffnungszeit, Lautstaerke und
 * Lichtstimmung als Sicht auf Tick, Lounge und Gaeste.
 *
 * Kein neues Save-Feld und keine zweite Gaestesimulation: die Lounge bleibt
 * der Ort, `businessAreas` zaehlt ihre Belegung, `dayPhaseOf` sagt die
 * Tageszeit. Der Club ist die Auslegung dieser drei vorhandenen Aussagen.
 */
import { businessAreas } from './business-areas';
import { dayPhaseOf, type DayPhase } from './day-phase';
import type { WorldState } from './types';

/** Ab dem Abend laeuft der Club; morgens ist die Flaeche kalt. */
const OPEN_PHASES: readonly DayPhase[] = ['evening', 'night'];
/** Grundlautstaerke der Anlage, sobald der Club offen ist. */
const BASE_VOLUME = 4;
/** Lautstaerke 0..10; jede anwesende Person im Club dreht um eins auf. */
const MAX_VOLUME = 10;
/** Ab diesem Pegel kippt die Stimmung: laut ist nicht mehr besser. */
const TOO_LOUD = 8;

interface ClubNight {
  /** Offen heisst: Lounge im Haus und Tageszeit passt. */
  readonly open: boolean;
  readonly phase: DayPhase;
  /** Gaeste auf der Flaeche, aus der bestehenden Bereichsableitung. */
  readonly guests: number;
  /** 0..10, abgeleitet aus Oeffnungszeit und Belegung. */
  readonly volume: number;
  /** Launepuls je Warteentscheidung im Club; 0, wenn er ruht. */
  readonly moodGain: number;
}

/** Der Clubabend, den dieses Haus gerade haette; reine Ableitung, kein RNG. */
export function clubNight(world: WorldState): ClubNight {
  const lounge = businessAreas(world).find((area) => area.id === 'LOUNGE')!;
  const phase = dayPhaseOf(world.tick);
  const open = lounge.open && OPEN_PHASES.includes(phase);
  if (!open) return { open: false, phase, guests: lounge.guests, volume: 0, moodGain: 0 };
  const volume = Math.min(MAX_VOLUME, BASE_VOLUME + lounge.guests);
  // Ab Stufe acht kostet der Pegel einen Punkt Laune statt sie zu heben.
  const moodGain = volume >= TOO_LOUD ? 2 : 3;
  return { open: true, phase, guests: lounge.guests, volume, moodGain };
}
