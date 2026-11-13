/**
 * Die Begegnung im Ort ist der zentrale Loop der Stadt:
 *
 *   Stadtaktion -> benannter NPC (Name, Rolle, Ort, Beziehung, Erinnerung)
 *   -> soziale Handlung (geben/helfen/ablehnen) bucht Geld, Energie, Beziehung
 *   -> der NPC erlebt es selbst (Wissen Distanz 0) und erzaehlt es weiter
 *      (zweiter NPC, Distanz 1, Konfidenzverlust)
 *   -> die Kette CITY_ENCOUNTER_ARC plant nach 24 Ticks eine sichtbare Folge.
 *
 * Hier steht nur die Eroeffnung der Szene; Dialog, Handlung und Wissen liegen
 * in eigenen Modulen, alle ueber vorhandene Systeme (`scheduleEvent`,
 * `executeChoice`, `recordVisitor`, `recordFirstHand`/`reportKnowledge`).
 */
import { cityOf } from './city-model';
import { ensureCityVisitor, locationName, primaryNpcAt, type CityNpcDef } from './city-npcs';
import { ensureCityLife } from './city-life-state';
import { rosterDefById } from './city-npc-roster';
import { ACTION_LABEL, lastEncounter, visitorRef } from './city-encounter-dialog';
import type { CityLocationId } from './city-types';
import type { NarrativeEventInstance } from './narrative/event-types';
import { scheduleEvent } from './narrative/event-scheduler';
import { isLiveEventStatus } from './narrative/event-lifecycle';
import { CITY_ENCOUNTER_EVENT_ID } from './narrative/events/definitions/city-encounter';
import type { Visitor, WorldState } from './types';

export { ENCOUNTER_ENERGY, ENCOUNTER_GIFT, ENCOUNTER_SMALL, takeEncounterAction } from './city-encounter-action';
export type { EncounterResult } from './city-encounter-action';
export { encounterDialog } from './city-encounter-dialog';
export type { EncounterDialog } from './city-encounter-dialog';

const isCityLocation = (value: string | undefined): value is CityLocationId =>
  value === 'KIEZ' || value === 'MARKT' || value === 'CASINO';

/**
 * Eine Stadtaktion oeffnet die Begegnung. Ziel ist entweder ein Ort (dann
 * spricht die dort anwesende Figur) oder eine Kennung aus der Besetzung
 * (`npc_4` … `npc_12`). Die Kennung ist die einzige Identitaet; Name, Rolle und
 * Profil kommen aus `rosterDefById`. Eine bereits offene Szene wird
 * zurueckgegeben, statt eine zweite zu stapeln.
 */
export function meetNpc(
  world: WorldState,
  target?: CityLocationId | string,
): { readonly npc: CityNpcDef; readonly visitor: Visitor; readonly event: NarrativeEventInstance } {
  const state = cityOf(world);
  const location = isCityLocation(target) ? target : state.location;
  if (state.location !== location) {
    throw new Error(`Diese Begegnung gehoert zu ${locationName(location)}, du bist in ${locationName(state.location)}.`);
  }
  const life = ensureCityLife(world);
  let npc: CityNpcDef | null;
  if (target && !isCityLocation(target)) {
    npc = rosterDefById(target, life.seed ?? 0);
    if (!npc) throw new Error(`Diese Figur steht nicht in der Besetzung: ${target}.`);
  } else {
    const resident = life.residents.find((entry) => entry.location === location);
    const primary = primaryNpcAt(location);
    npc = rosterDefById(resident?.npcId ?? primary?.id ?? '', life.seed ?? 0);
  }
  if (!npc) throw new Error(`In ${locationName(location)} wartet heute niemand auf ein Gespraech.`);
  const visitor = ensureCityVisitor(world, npc);
  const ref = visitorRef(visitor.id);
  const live = world.narrative.events.find((entry) => entry.eventId === CITY_ENCOUNTER_EVENT_ID
    && entry.participants[0] === ref && isLiveEventStatus(entry.status));
  if (live) return { npc, visitor, event: live };
  const event = scheduleEvent(world, {
    eventId: CITY_ENCOUNTER_EVENT_ID,
    templateVersion: 1,
    scope: 'VISITOR',
    participants: [ref],
    sourceFactId: 0,
    priority: 55,
    offeredChoiceIds: ['GIVE_ROUND', 'HELP_CRATE', 'DECLINE_ASK'],
    expiresInTicks: 40,
    maxOccurrences: 99,
    cooldownTicks: 0,
    step: 'START',
  });
  if (!event) throw new Error(`Die Begegnung mit ${npc.name} konnte nicht geoeffnet werden.`);
  const seen = lastEncounter(world, visitor.id);
  const memory = seen
    ? `${npc.name} erinnert sich an Tag ${seen.day}: ${ACTION_LABEL[seen.action]}.`
    : `${npc.name} sieht dich zum ersten Mal.`;
  const text = `${npc.name} (${npc.role}, ${locationName(npc.location)}): ${memory}`;
  world.city = { ...cityOf(world), lastText: text, lastResult: text };
  world.lastEvent = text;
  return { npc, visitor, event };
}
