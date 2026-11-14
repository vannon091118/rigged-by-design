/**
 * Nachfrage: Ankuenfte werden geplant statt pro Tick gewuerfelt.
 * Es gibt keine Gaesteobergrenze; Sitzplaetze und Kasse entscheiden nur,
 * wie gut der Betrieb den Andrang bedient. Die Quellen stehen in
 * `demand-sources.ts`, hier steht die Planung und der Einlass.
 */
import { TICKS_PER_DAY, tickInDay } from './clock';
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { activeDemand } from './narrative/demand-events';
import { demandBreakdown, isPeak, tierRank, TIER_NAME, TIER_PER_DAY } from './demand-sources';
import { recordJournal } from './journal';
import { companyTier } from './progression';
import { openVenueEvent } from './venue-event';
import { spawnGuest } from './spawn';
import { exchangePoint } from './world';
import type { DemandEventKind, DemandTier, WorldState } from './types';

export { demandBreakdown } from './demand-sources';

/** Der erste Gast steht nach sechs Sekunden vor der Tuer, egal wie der Wuerfel faellt. */
export const FIRST_ARRIVAL_TICK = 12;
const MIN_GAP = 4;

const EVENT_CHANCE: Readonly<Record<DemandTier, number>> = { BUDE: 0, KASSE: 0.18, SAAL: 0.28, KONZERN: 0.36 };

/** Exponentialverteiltes Intervall; die Stichprobe folgt der angezeigten Rate ohne Deckel. */
export function arrivalGap(prng: Prng, perDay: number): number {
  const perTick = Math.max(1, perDay) / TICKS_PER_DAY;
  const roll = Math.min(0.999, Math.max(0.001, prng.nextFloat()));
  const gap = Math.round(-Math.log(1 - roll) / perTick);
  return Math.max(MIN_GAP, gap);
}

/** Spaetere Stufen kommen in kleinen Gruppen; die Gruppengroesse ist ein Parameter, keine Grenze. */
function groupSize(world: WorldState, prng: Prng): number {
  const rank = tierRank(world.demandTier);
  const roll = prng.nextFloat();
  let size = 1;
  if (roll < 0.015 + rank * 0.02) size = 3;
  else if (roll < 0.08 + rank * 0.05) size = 2;
  if (isPeak(world) && prng.nextFloat() < 0.1 + rank * 0.04) size += 1;
  const active = activeDemand(world);
  if (active && prng.nextFloat() < active.definition.groupChance) size += 1;
  return Math.min(4, size);
}

/**
 * Erwartete Gruppengroesse aus denselben Wahrscheinlichkeiten wie groupSize: Der Andrang
 * zaehlt Gaeste, nicht Gruppen, sonst kommen mehr Leute als geplant.
 */
function expectedGroupSize(world: WorldState): number {
  const rank = tierRank(world.demandTier);
  const p3 = 0.015 + rank * 0.02;
  const p2 = 0.08 + rank * 0.05;
  let mean = 1 + (p2 - p3) + 2 * p3;
  if (isPeak(world)) mean += 0.1 + rank * 0.04;
  const active = activeDemand(world);
  if (active) mean += active.definition.groupMean;
  return mean;
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
  if (tickInDay(world.tick) !== 0) return;
  advanceDemandTier(world, ledger);
  // Der Scheduler und die Runtime beenden faellige Instanzen; hier wird nur gestartet.
  if (activeDemand(world) || world.demandTier === 'BUDE') return;
  if (prng.nextFloat() >= EVENT_CHANCE[world.demandTier]) return;
  const kind: DemandEventKind = prng.nextFloat() < 0.55 ? 'NEON_NACHT' : 'TURNIER_ABEND';
  openVenueEvent(world, kind);
}

/** Ein aufgestelltes Geraet ist die Voraussetzung fuer einen Gast; ohne es gibt es nichts zu spielen. */
function hasPlayableDevice(world: WorldState): boolean {
  return world.furniture.some((item) => Boolean(item.gameId));
}

/** Plant die naechste Ankunft und laesst faellige Gruppen herein. Kein Blick auf eine Gaestezahl. */
export function tickDemand(world: WorldState, ledger: Ledger, prng: Prng): void {
  // Nur der eigene Floor mit Kasse zieht neue Gaeste; bestehende Gaeste ticken in tickWorld weiter.
  if (world.scene.kind !== 'OWN' || !exchangePoint(world)) return;
  // Ohne Automat steht der erste Gast vor GERÄTE 0/0: Die Frist beginnt erst mit
  // dem ersten spielbaren Geraet (#534/S1-06), nicht mit dem Betreten des Raums.
  if (!hasPlayableDevice(world)) {
    world.nextArrivalTick = world.tick + FIRST_ARRIVAL_TICK;
    return;
  }
  tickEvent(world, ledger, prng);
  if (world.tick < world.nextArrivalTick) return;
  const demand = demandBreakdown(world);
  const size = groupSize(world, prng);
  let spawned = 0;
  for (let index = 0; index < size; index += 1) {
    if (spawnGuest(world, prng, ledger)) spawned += 1;
  }
  // Ohne einen einzigen Gast bleibt der Termin stehen; auch der Takt verbraucht keinen Zufall.
  if (spawned === 0) return;
  // Die Rate gilt fuer Gaeste; eine Gruppe kommt zusammen und verschiebt nur den Takt.
  world.nextArrivalTick = world.tick + arrivalGap(prng, demand.perDay / expectedGroupSize(world));
}
