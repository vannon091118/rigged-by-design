/**
 * Faktor-Leser des Hot-Event-Scores (#806).
 *
 * Jede Verzweigung liest ausschliesslich Felder, die der Fact wirklich
 * traegt. Fehlt ein Messwert, bleibt der Faktor weg, statt erfunden zu werden.
 * Die Normalisierung ist Teil der Konfiguration, nicht dieser Datei.
 */
import { fromVC } from '../../economy/vacoin';
import type { WorldState } from '../types';
import type { HotEventConfig, HotEventFactor } from './hot-event-config';
import type { NarrativeFact } from './types';

interface FactorReading {
  readonly value: number;
  readonly reason: string;
}

type FactorReadings = Partial<Record<HotEventFactor, FactorReading>>;

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const ratio = (value: number, scale: number): number => (scale > 0 ? clamp01(value / scale) : 0);

const reachOf = (refs: readonly string[] | undefined): FactorReading | null => {
  if (!refs || refs.length === 0) return null;
  return { value: clamp01(refs.length / 3), reason: `${refs.length} beteiligte Akteure` };
};

/** Liest die belegten Faktoren eines Facts; kein Default fuer unbekannte Arten. */
export function factFactors(fact: NarrativeFact, config: HotEventConfig): FactorReadings {
  const vcScale = fromVC(config.vcScale);
  const readings: FactorReadings = {};
  const reach = 'actorRefs' in fact ? reachOf(fact.actorRefs) : null;
  if (reach) readings.reach = reach;
  switch (fact.kind) {
    case 'VISIT_ENDED': {
      const magnitude = ratio(Math.abs(fact.score), config.scoreScale);
      readings.reach = { value: 1 / 3, reason: 'ein Besucher' };
      readings.consequence = { value: magnitude, reason: `Besuchsbewertung ${fact.score}` };
      if (fact.valence === 'BAD') readings.conflict = { value: magnitude, reason: 'negativer Abschluss' };
      if (fact.valence === 'GOOD') readings.achievement = { value: magnitude, reason: 'positiver Abschluss' };
      break;
    }
    case 'SLOT_DISCHARGE': {
      const payout = Math.max(0, fact.payout);
      readings.consequence = { value: ratio(payout, vcScale), reason: `Auszahlung ${payout} micro-VC` };
      readings.achievement = {
        value: fact.stake > 0 ? clamp01(payout / (fact.stake * 10)) : 0,
        reason: `Auszahlung gegen Einsatz ${fact.stake}`,
      };
      break;
    }
    case 'VISITOR_CONFLICT':
      readings.conflict = { value: clamp01(fact.severity / 2), reason: `Streit-Severity ${fact.severity}` };
      readings.consequence = {
        value: fact.severity >= 2 ? 1 : 0.5,
        reason: fact.severity >= 2 ? 'eskalierter Streit' : 'kleiner Streit',
      };
      break;
    case 'VISITOR_SERVICE':
      if (fact.valence === 'GOOD') readings.achievement = { value: 0.5, reason: 'guter Service' };
      if (fact.valence === 'BAD') readings.conflict = { value: 0.4, reason: 'schlechter Service' };
      break;
    case 'RIVAL_ENCOUNTER':
      readings.consequence = {
        value: ratio(Math.abs(fact.netToHouse), vcScale), reason: `Nettofluss ${fact.netToHouse} micro-VC`,
      };
      break;
    case 'RIVAL_ACTION':
      readings.conflict = {
        value: fact.evidence ? 0.9 : 0.5, reason: fact.evidence ? 'Sabotage mit Indiz' : 'Rivalenhandlung',
      };
      readings.consequence = { value: 0.6, reason: 'Eingriff in den Betrieb' };
      break;
    case 'HOUSE_BALANCE':
      readings.consequence = { value: ratio(Math.abs(fact.balance), vcScale), reason: `Hauskonto ${fact.balance} micro-VC` };
      break;
    case 'EVENT_RESOLVED':
      readings.achievement = { value: 0.5, reason: `Choice ${fact.choiceId} aufgeloest` };
      readings.consequence = { value: 0.3, reason: 'abgeschlossene Szene' };
      break;
    case 'DEVICE_FAULT':
      readings.consequence = { value: 0.35, reason: `${fact.kindLabel} ${fact.reason}` };
      break;
    case 'STOCK_LOW':
      readings.consequence = { value: 0.25, reason: `${fact.kindLabel} Bestand ${fact.stock}` };
      break;
    case 'START_POOL':
      readings.consequence = { value: ratio(fact.capital, vcScale), reason: `Startkapital ${fact.capital}` };
      break;
    case 'VISITOR_FIRST_SEEN':
    case 'VISITOR_RETURNED':
      readings.reach = { value: 1 / 3, reason: 'ein Besucher' };
      break;
    case 'COMMAND_REJECTED':
      break;
    default:
      break;
  }
  return readings;
}

/**
 * Neuigkeit ist die einzige Groesse, die Historie liest: Gleichartige Facts im
 * Fenster machen ein Ereignis gewoehnlich. Dieselbe Welt ergibt denselben Wert.
 */
export function noveltyReading(world: WorldState, fact: NarrativeFact, config: HotEventConfig): FactorReading {
  const windowStart = fact.tick - config.noveltyWindowTicks;
  const sameKind = world.narrative.recent
    .filter((entry) => entry.kind === fact.kind && entry.id !== fact.id && entry.tick >= windowStart)
    .length;
  return {
    value: clamp01(1 - sameKind / config.noveltySaturation),
    reason: `${sameKind} gleichartige Facts in ${config.noveltyWindowTicks} Ticks`,
  };
}
