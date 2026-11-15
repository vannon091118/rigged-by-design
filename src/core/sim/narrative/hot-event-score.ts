/**
 * Hot-Event-Score (#806): Wie gesellschaftlich tragweite ein belegter Fact ist.
 *
 * Der Score ist eine reine Ableitung aus dem Fact, der vorhandenen Historie
 * und seiner Konfiguration. Er schreibt nichts, wuerfelt nicht und kennt keine
 * zweite Eventliste: Der Ausloeser ist eine gewoehnliche `EventCandidate` und
 * laeuft durch denselben Scheduler wie jeder andere.
 */
import type { WorldState } from '../types';
import { scheduleCandidates } from './event-scheduler';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { factFactors, noveltyReading } from './hot-event-factors';
import {
  HOT_EVENT_CONFIG, HOT_EVENT_FACTORS, type HotEventConfig, type HotEventFactor,
} from './hot-event-config';
import type { NarrativeFact } from './types';

/** Die stabile Kennung des Ausloesers; die Fact-ID bleibt die Ursache. */
export const HOT_EVENT_ID = 'HOT_EVENT';

/** Ein Ausloeser lebt kurz: Er ist ein Signal, keine Szene mit Belohnung. */
const HOT_EVENT_TTL = 12;
/** Grundprioritaet; der Ueberschuss ueber die Schwelle hebt sie an. */
const HOT_EVENT_BASE_PRIORITY = 60;

interface HotEventContribution {
  readonly factor: HotEventFactor;
  /** 0..1, normalisiert aus einem echten Feld. */
  readonly value: number;
  readonly weight: number;
  readonly points: number;
  /** Warum dieser Faktor so hoch ist; nennt das Feld, nicht eine Meinung. */
  readonly reason: string;
}

interface HotEventScore {
  readonly factId: number;
  readonly factKind: NarrativeFact['kind'];
  readonly total: number;
  readonly threshold: number;
  readonly hot: boolean;
  readonly contributions: readonly HotEventContribution[];
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Bewertet genau einen Fact; gleicher Zustand und Fact ergeben denselben Score. */
export function hotEventScore(
  world: WorldState, fact: NarrativeFact, config: HotEventConfig = HOT_EVENT_CONFIG,
): HotEventScore {
  const readings = factFactors(fact, config);
  readings.novelty = noveltyReading(world, fact, config);
  const contributions: HotEventContribution[] = [];
  for (const factor of HOT_EVENT_FACTORS) {
    const reading = readings[factor];
    if (!reading) continue;
    const weight = config.weights[factor];
    if (weight === 0) continue;
    contributions.push({
      factor,
      value: round(reading.value),
      weight,
      points: round(reading.value * weight),
      reason: reading.reason,
    });
  }
  const total = round(contributions.reduce((sum, entry) => sum + entry.points, 0));
  const threshold = config.thresholds[fact.kind] ?? config.defaultThreshold;
  return { factId: fact.id, factKind: fact.kind, total, threshold, hot: total >= threshold, contributions };
}

/** Alle bisherigen Ausloeser; die eine Lesestelle fuer die naechste Phase. */
export function hotEventTriggers(world: WorldState): readonly NarrativeEventInstance[] {
  return world.narrative.events.filter((event) => event.eventId === HOT_EVENT_ID);
}

/** Ein Fact loest hoechstens eine Instanz aus; die Fact-ID ist der Schluessel. */
function alreadyTriggered(world: WorldState, factId: number): boolean {
  return hotEventTriggers(world).some((event) => event.sourceFactId === factId);
}

/**
 * Baut den Ausloeser aus dem Score. `GLOBAL` ohne Teilnehmer, weil Hitze noch
 * niemandem gilt; die naechste Phase entscheidet, wer davon erfaehrt.
 */
function hotEventCandidate(
  world: WorldState, fact: NarrativeFact, config: HotEventConfig = HOT_EVENT_CONFIG,
): EventCandidate | null {
  const score = hotEventScore(world, fact, config);
  if (!score.hot || alreadyTriggered(world, fact.id)) return null;
  return {
    eventId: HOT_EVENT_ID,
    scope: 'GLOBAL',
    participants: [],
    sourceFactId: fact.id,
    priority: Math.min(99, HOT_EVENT_BASE_PRIORITY + Math.round(score.total - score.threshold)),
    expiresInTicks: HOT_EVENT_TTL,
    maxOccurrences: 0,
    cooldownTicks: 0,
    step: 'START',
  };
}

/** Alle Kandidaten eines Laufs; Facts unter der Schwelle erzeugen keinen Eintrag. */
export function hotEventCandidates(
  world: WorldState, facts: readonly NarrativeFact[], config: HotEventConfig = HOT_EVENT_CONFIG,
): EventCandidate[] {
  const candidates: EventCandidate[] = [];
  for (const fact of facts) {
    const candidate = hotEventCandidate(world, fact, config);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

/** Plant die Ausloeser ueber den vorhandenen Scheduler; keine Sonderlogik dort. */
export function scheduleHotEvents(
  world: WorldState, facts: readonly NarrativeFact[], config: HotEventConfig = HOT_EVENT_CONFIG,
): NarrativeEventInstance[] {
  return scheduleCandidates(world, hotEventCandidates(world, facts, config), world.tick);
}
