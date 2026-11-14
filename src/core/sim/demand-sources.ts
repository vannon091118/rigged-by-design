/**
 * Die Nachfragequellen einzeln und nachvollziehbar: Grundrauschen, Ruf,
 * Zufriedenheit, Stammgaeste, Anziehung, Unternehmensstufe, Stosszeit, Ereignis
 * und der Malus aus unsicherem Ruf. Die Planung der Ankuenfte steht in
 * `demand.ts`; hier steht nur, wie viel Andrang ein Haus anzieht.
 */
import { tickInDay } from './clock';
import { activeDemand } from './narrative/demand-events';
import { attractionOf } from './offers';
import { UNSAFE_REPUTATION_SPAWN_FACTOR } from './penalty-pool';
import { reputation } from './spawn';
import type { DemandEventKind, DemandSnapshot, DemandSource, DemandTier, WorldState } from './types';

const PEAK_FROM = 360;
const PEAK_TO = 540;

/** Balancierbare Nachfrage in Gaesten pro Tag; keine davon ist eine Obergrenze. */
const BASE_PER_DAY = 8;
const REPUTATION_PER_DAY = 12;
const SATISFACTION_PER_DAY = 8;
const REGULAR_PER_DAY = 2;
const REGULAR_CAP = 14;
const ATTRACTION_PER_DAY = 10;
const ATTRACTION_DIVISOR = 250;
const PEAK_PER_DAY = 6;

const TIER_ORDER: readonly DemandTier[] = ['BUDE', 'KASSE', 'SAAL', 'KONZERN'];
export const TIER_NAME: Readonly<Record<DemandTier, string>> = {
  BUDE: 'Hinterhof-Bude', KASSE: 'Bude mit Kasse', SAAL: 'Spielsaal', KONZERN: 'Konzern',
};
/** Jede erreichte Stufe schaltet Nachfrage hinzu; sie deckelt nichts. */
export const TIER_PER_DAY: Readonly<Record<DemandTier, number>> = { BUDE: 0, KASSE: 8, SAAL: 12, KONZERN: 24 };

export function isPeak(world: WorldState): boolean {
  const phase = tickInDay(world.tick);
  return phase >= PEAK_FROM && phase < PEAK_TO;
}

export function tierRank(tier: DemandTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Alle Quellen einzeln, damit der Andrang nachvollziehbar bleibt. */
export function demandBreakdown(world: WorldState): DemandSnapshot {
  const rep = reputation(world);
  const regulars = world.visitors.filter((visitor) => visitor.visits >= 2).length;
  const sources: DemandSource[] = [
    { id: 'BASE', label: 'Grundrauschen', perDay: BASE_PER_DAY },
    { id: 'REPUTATION', label: `Ruf ${Math.round(rep)} %`, perDay: (rep / 100) * REPUTATION_PER_DAY },
    {
      id: 'SATISFACTION',
      label: `Zufriedenheit ${Math.round(world.satisfaction)} %`,
      perDay: (world.satisfaction / 100) * SATISFACTION_PER_DAY,
    },
    {
      id: 'REGULARS',
      label: `Stammgäste ${regulars}`,
      // Stammgäste bringen nur Nachfrage, wenn der Laden sie auch zufrieden entlaesst.
      perDay: Math.min(REGULAR_CAP, regulars * REGULAR_PER_DAY) * (world.satisfaction / 100),
    },
    {
      id: 'ATTRACTION',
      label: 'Anziehung',
      perDay: Math.min(ATTRACTION_PER_DAY, attractionOf(world) / ATTRACTION_DIVISOR),
    },
    { id: 'TIER', label: `Stufe ${TIER_NAME[world.demandTier]}`, perDay: TIER_PER_DAY[world.demandTier] },
  ];
  if (isPeak(world)) sources.push({ id: 'PEAK', label: 'Stoßzeit am Abend', perDay: PEAK_PER_DAY });
  const active = activeDemand(world);
  if (active) {
    sources.push({
      id: 'EVENT',
      label: active.definition.label,
      perDay: active.definition.perDay,
    });
  }
  let perDay = sources.reduce((sum, source) => sum + source.perDay, 0);
  if (world.activePenalties.some((penalty) => penalty.kind === 'UNSAFE_REPUTATION')) {
    const malus = perDay * (1 - UNSAFE_REPUTATION_SPAWN_FACTOR);
    sources.push({ id: 'UNSAFE', label: 'Unsicherer Ruf', perDay: -malus });
    perDay -= malus;
  }
  const event = active
    ? {
        kind: active.event.eventId as DemandEventKind,
        label: active.definition.label,
        ticksLeft: Math.max(0, active.event.expiresTick - world.tick),
      }
    : null;
  return {
    perDay,
    sources,
    nextArrivalIn: Math.max(0, world.nextArrivalTick - world.tick),
    event,
  };
}
