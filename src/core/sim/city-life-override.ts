/**
 * @module city-life-override — Öffnungszeiten und dringende Bedürfnisse
 *
 * Zwei Regeln, die den Score begrenzen statt ihn zu ersetzen: Ein Gewerbe hat
 * Öffnungszeiten, und ein dringendes körperliches Bedürfnis verbietet Arbeit,
 * Einkauf, Freizeit und Besuche. Beide Regeln liefern nur Faktoren; die
 * Entscheidung bleibt beim Score, damit die Gegenfakt-Proben sie neutralisieren
 * können.
 */
import type { CityDecisionFamily, CityLifePlace } from './city-life-types';
import { venueOpenAt, workAllowedAt } from './city-life-venues';
import {
  FATIGUE_THRESHOLD_URGENT, HUNGER_THRESHOLD_URGENT, THIRST_THRESHOLD_URGENT,
  needsOverrideIntent,
} from './npc-needs';
import type { NpcIntentKind, NpcNeeds } from './npc-types';
import { needAtLeast } from './needs-core';

/**
 * Was ein dringendes Bedürfnis verbietet: Arbeit, Einkauf, Freizeit und
 * Besuche. Schlafen, Essen, Trinken und der Weg dorthin bleiben erlaubt, damit
 * der Score weiter zwischen ihnen wählt (eine Kneipe hat auch Wasser).
 */
const VETOED_BY_URGENT_NEED: readonly NpcIntentKind[] = ['WORK', 'SHOP', 'LEISURE', 'VISIT_FRIEND'];

/** Stärke des Vetos: größer als Plan, Können und Charisma zusammen. */
export const URGENT_NEED_VETO = 400;
/** Eine geschlossene Tür ist keine Alternative, sondern ein Ausschluss. */
export const CLOSED_PENALTY = 1000;

interface NeedVeto {
  readonly intent: NpcIntentKind;
  readonly family: CityDecisionFamily;
}

/**
 * Dringende Bedürfnisse bekommen im echten Tick eine Stimme, nicht nur im
 * Test. `needsOverrideIntent` liefert dieselbe Priorität wie im Tagesplan
 * (Müdigkeit vor Hunger vor Durst vor Sozialbedarf); hier wirkt sie als Veto.
 * Nur die körperlichen Bedürfnisse zählen: Sozialbedarf bleibt eine Bewertung,
 * denn Einsamkeit verbietet weder den Weg zur Arbeit noch das Essen.
 */
export function urgentNeedVeto(needs: NpcNeeds): NeedVeto | null {
  if (needAtLeast(needs.fatigue, FATIGUE_THRESHOLD_URGENT)) return { intent: 'SLEEP', family: 'fatigue' };
  const intent = needsOverrideIntent(needs);
  if (!intent) return null;
  if (needAtLeast(needs.hunger, HUNGER_THRESHOLD_URGENT)) return { intent, family: 'hunger' };
  if (needAtLeast(needs.thirst, THIRST_THRESHOLD_URGENT)) return { intent, family: 'thirst' };
  return null;
}

/** Trifft das Veto genau diese Handlung? */
export function vetoesIntent(veto: NeedVeto | null, intent: NpcIntentKind): boolean {
  return veto !== null && VETOED_BY_URGENT_NEED.includes(intent);
}

/**
 * Ist diese Handlung zu dieser Stunde geschlossen? Die Zeiten kommen aus der
 * Stadt: Arbeit aus dem eigenen Slot, Kneipe/Einkauf/Auswärtsessen aus den
 * Öffnungszeiten des Gebäudes am Ort. Schlafen, Essen zu Hause, Pendeln,
 * Spazieren und Besuche sind keine Gewerbe und immer möglich.
 */
export function isClosedAt(
  intent: NpcIntentKind, hour: number,
  context: { readonly npcId: string; readonly workplace: CityLifePlace },
): boolean {
  switch (intent) {
    case 'WORK': return !workAllowedAt(context.npcId, hour);
    case 'PUB': return !venueOpenAt('KIEZ', hour);
    case 'SHOP': return !venueOpenAt(context.workplace, hour);
    case 'EAT_OUT': return !venueOpenAt('KIEZ', hour) && !venueOpenAt('MARKT', hour);
    default: return false;
  }
}
