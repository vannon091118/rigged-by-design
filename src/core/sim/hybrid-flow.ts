/**
 * Hybrid-Besucherstroeme (Agent 20): der erste Weg eines Gastes haengt vom
 * laufenden Betrieb ab, nicht von einer zweiten Rollen- oder Eventsimulation.
 *
 * Ein laufendes Nachfrage-Event (Neon-Nacht, Turnierabend) bringt Gaeste, die
 * zuerst trinken wollen. Das ist derselbe Beduerfnis-Zustand, den `needs.ts`
 * ohnehin fuehrt: kein neues Save-Feld, kein zweiter Event-Zustand, keine
 * zweite Gaesteliste. Bar- und Automatenwege bleiben `chooseActivity`.
 */
import { activeDemand } from './narrative/demand-events';
import type { Guest, WorldState } from './types';

/** Ab hier haelt `refreshNeeds` das Trinkbeduerfnis; darunter faellt es auf Spielen zurueck. */
const EVENT_ARRIVAL_THIRST = 65;

/**
 * Setzt bei Veranstaltungsgaesten Durst und Trinkbeduerfnis. Ohne laufendes
 * Event bleibt der Gast unveraendert; der Aufruf ist idempotent und ohne RNG.
 */
export function applyArrivalFlow(world: WorldState, guest: Guest): void {
  if (!activeDemand(world)) return;
  guest.need = 'drink';
  guest.thirst = Math.max(guest.thirst, EVENT_ARRIVAL_THIRST);
}
