/**
 * Nachfrage: Ankuenfte werden geplant statt pro Tick gewuerfelt.
 * Es gibt keine Gaesteobergrenze; Sitzplaetze und Kasse entscheiden nur,
 * wie gut der Betrieb den Andrang bedient.
 */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { recordJournal } from './journal';
import { attractionOf } from './offers';
import { UNSAFE_REPUTATION_SPAWN_FACTOR } from './penalty-pool';
import { companyTier } from './progression';
import { reputation, spawnGuest } from './spawn';
import type { DemandEventKind, DemandSnapshot, DemandSource, DemandTier, WorldState } from './types';

export const TICKS_PER_DAY = 600;
/** Der erste Gast steht nach sechs Sekunden vor der Tuer, egal wie der Wuerfel faellt. */
export const FIRST_ARRIVAL_TICK = 12;
const MIN_GAP = 4;
const MAX_GAP = 90;
const PEAK_FROM = 360;
const PEAK_TO = 540;
const EVENT_TICKS = 150;

/** Balancierbare Nachfrage in Gaesten pro Tag; keine davon ist eine Obergrenze. */
const BASE_PER_DAY = 4;
const REPUTATION_PER_DAY = 8;
const SATISFACTION_PER_DAY = 8;
const REGULAR_PER_DAY = 2;
const REGULAR_CAP = 14;
const ATTRACTION_PER_DAY = 8;
const ATTRACTION_DIVISOR = 300;
const PEAK_PER_DAY = 5;

const TIER_ORDER: readonly DemandTier[] = ['BUDE', 'KASSE', 'SAAL', 'KONZERN'];
const TIER_NAME: Readonly<Record<DemandTier, string>> = {
  BUDE: 'Hinterhof-Bude', KASSE: 'Bude mit Kasse', SAAL: 'Spielsaal', KONZERN: 'Konzern',
};
/** Jede erreichte Stufe schaltet Nachfrage hinzu; sie deckelt nichts. */
const TIER_PER_DAY: Readonly<Record<DemandTier, number>> = { BUDE: 0, KASSE: 6, SAAL: 14, KONZERN: 24 };
const EVENT_CHANCE: Readonly<Record<DemandTier, number>> = { BUDE: 0, KASSE: 0.18, SAAL: 0.28, KONZERN: 0.36 };
const EVENT_NAME: Readonly<Record<DemandEventKind, string>> = {
  NEON_NACHT: 'Neon-Nacht', TURNIER_ABEND: 'Turnierabend',
};
const EVENT_PER_DAY: Readonly<Record<DemandEventKind, number>> = { NEON_NACHT: 25, TURNIER_ABEND: 18 };

function isPeak(world: WorldState): boolean {
  const phase = world.tick % TICKS_PER_DAY;
  return phase >= PEAK_FROM && phase < PEAK_TO;
}

function tierRank(tier: DemandTier): number {
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
  if (world.demandEvent) {
    sources.push({
      id: 'EVENT',
      label: EVENT_NAME[world.demandEvent.kind],
      perDay: EVENT_PER_DAY[world.demandEvent.kind],
    });
  }
  let perDay = sources.reduce((sum, source) => sum + source.perDay, 0);
  if (world.activePenalties.some((penalty) => penalty.kind === 'UNSAFE_REPUTATION')) {
    const malus = perDay * (1 - UNSAFE_REPUTATION_SPAWN_FACTOR);
    sources.push({ id: 'UNSAFE', label: 'Unsicherer Ruf', perDay: -malus });
    perDay -= malus;
  }
  const event = world.demandEvent
    ? {
        kind: world.demandEvent.kind,
        label: EVENT_NAME[world.demandEvent.kind],
        ticksLeft: Math.max(0, world.demandEvent.untilTick - world.tick),
      }
    : null;
  return {
    perDay,
    sources,
    nextArrivalIn: Math.max(0, world.nextArrivalTick - world.tick),
    event,
  };
}

/** Exponentialverteiltes Intervall: selten lange Pausen, nie ein minutenlanger Stillstand. */
function arrivalGap(prng: Prng, perDay: number): number {
  const perTick = Math.max(1, perDay) / TICKS_PER_DAY;
  const roll = Math.min(0.999, Math.max(0.001, prng.nextFloat()));
  const gap = Math.round(-Math.log(1 - roll) / perTick);
  return Math.min(MAX_GAP, Math.max(MIN_GAP, gap));
}

/** Spaetere Stufen kommen in kleinen Gruppen; die Gruppengroesse ist ein Parameter, keine Grenze. */
function groupSize(world: WorldState, prng: Prng): number {
  const rank = tierRank(world.demandTier);
  const roll = prng.nextFloat();
  let size = 1;
  if (roll < 0.015 + rank * 0.02) size = 3;
  else if (roll < 0.08 + rank * 0.05) size = 2;
  if (isPeak(world) && prng.nextFloat() < 0.1 + rank * 0.04) size += 1;
  if (world.demandEvent && prng.nextFloat() < 0.55) size += 1;
  return Math.min(4, size);
}

/** Die hoechste erreichte Stufe bleibt fuer die Nachfrage freigeschaltet. */
function advanceDemandTier(world: WorldState, ledger: Ledger): void {
  const reached = companyTier(world, ledger);
  if (tierRank(reached) <= tierRank(world.demandTier)) return;
  world.demandTier = reached;
  world.lastEvent = `Stufe ${TIER_NAME[reached]} erreicht: ${TIER_PER_DAY[reached]} Gäste/Tag zusätzliche Nachfrage.`;
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: TIER_NAME[reached],
    cause: 'Unternehmensstufe erreicht',
    effect: world.lastEvent,
  });
}

function tickEvent(world: WorldState, ledger: Ledger, prng: Prng): void {
  if (world.demandEvent && world.tick >= world.demandEvent.untilTick) {
    const label = EVENT_NAME[world.demandEvent.kind];
    world.demandEvent = null;
    world.lastEvent = `${label} ist vorbei. Der Andrang normalisiert sich.`;
    recordJournal(world, {
      kind: 'SYSTEM', subject: label, cause: 'Veranstaltung beendet', effect: world.lastEvent,
    });
  }
  if (world.tick % TICKS_PER_DAY !== 0) return;
  advanceDemandTier(world, ledger);
  if (world.demandEvent || world.demandTier === 'BUDE') return;
  if (prng.nextFloat() >= EVENT_CHANCE[world.demandTier]) return;
  const kind: DemandEventKind = prng.nextFloat() < 0.55 ? 'NEON_NACHT' : 'TURNIER_ABEND';
  world.demandEvent = { kind, untilTick: world.tick + EVENT_TICKS };
  // Die erste Welle steht sofort vor der Tuer, nicht erst nach dem naechsten Intervall.
  world.nextArrivalTick = Math.min(world.nextArrivalTick, world.tick + 1);
  world.lastEvent = kind === 'NEON_NACHT'
    ? 'Neon-Nacht: Die Straße leuchtet, der Laden füllt sich.'
    : 'Turnierabend: Die Tische sind reserviert, Gäste kommen in Gruppen.';
  recordJournal(world, {
    kind: 'SYSTEM', subject: EVENT_NAME[kind], cause: 'Veranstaltung gestartet', effect: world.lastEvent,
  });
}

/** Plant die naechste Ankunft und laesst faellige Gruppen herein. Kein Blick auf eine Gaestezahl. */
export function tickDemand(world: WorldState, ledger: Ledger, prng: Prng): void {
  tickEvent(world, ledger, prng);
  if (world.tick < world.nextArrivalTick) return;
  const demand = demandBreakdown(world);
  const size = groupSize(world, prng);
  for (let index = 0; index < size; index += 1) spawnGuest(world, prng, ledger);
  world.nextArrivalTick = world.tick + arrivalGap(prng, demand.perDay);
}
