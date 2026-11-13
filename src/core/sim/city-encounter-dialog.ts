/** Die Begegnung als Spieltext: Sprecher, Rolle, Ort und gespeicherte Erinnerung. */
import type { Ledger } from '../economy/ledger';
import { cityOf } from './city-model';
import { locationName, type CityNpcDef } from './city-npcs';
import { ensureCityLife } from './city-life-state';
import { rosterDefById } from './city-npc-roster';
import type { NarrativeEventInstance } from './narrative/event-types';
import type { NarrativeEventView } from './narrative/view-types';
import { buildNarrativeView } from './narrative/view';
import { relationshipBetween } from './narrative/relationships';
import type { CityEncounterRecord, EncounterAction } from './city-types';
import type { Visitor, WorldState } from './types';

export const ACTION_LABEL: Readonly<Record<EncounterAction, string>> = {
  GEBEN: 'eine Runde ausgegeben',
  HELFEN: 'mit angepackt',
  ABLEHNEN: 'die Bitte abgelehnt',
};

export const visitorRef = (id: number): `visitor:${number}` => `visitor:${id}`;

const visitorIdOfEvent = (event: NarrativeEventInstance): number | null => {
  const ref = event.participants[0];
  const match = ref ? /^visitor:(\d+)$/.exec(ref) : null;
  return match ? Number(match[1]) : null;
};

/**
 * Der eine Identitaetsweg fuer Dialog und Handlung: Event -> Visitor ->
 * `residentNpcId` -> `rosterDefById`. Ein fehlender oder unbekannter Traeger
 * wirft sichtbar; Name, Listenindex und Default-Definition sind keine Ersatz-
 * Schluessel.
 */
export function encounterNpc(
  world: WorldState, event: NarrativeEventInstance,
): { readonly visitorId: number; readonly visitor: Visitor; readonly npc: CityNpcDef } {
  const visitorId = visitorIdOfEvent(event);
  if (visitorId === null) throw new Error('Die Begegnung hat keinen Visitor-Verweis.');
  const visitor = world.visitors.find((entry) => entry.id === visitorId);
  if (!visitor) throw new Error(`Zur Begegnung fehlt der Visitor ${visitorId}.`);
  const residentNpcId = visitor.residentNpcId;
  if (!residentNpcId) {
    throw new Error(`Die Begegnung mit ${visitor.name} hat keine Bewohnerkennung.`);
  }
  const npc = rosterDefById(residentNpcId, ensureCityLife(world).seed ?? 0);
  if (!npc) throw new Error(`Die Bewohnerkennung ${residentNpcId} steht nicht in der Besetzung.`);
  return { visitorId, visitor, npc };
}

/** Die letzte Begegnung mit genau diesem NPC; die Quelle der Erinnerung. */
export function lastEncounter(world: WorldState, npcId: number): CityEncounterRecord | null {
  const records = cityOf(world).encounters ?? [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]!.npcId === npcId) return records[index]!;
  }
  return null;
}

export interface EncounterDialog {
  readonly eventId: number;
  readonly event: string;
  readonly speaker: string;
  readonly role: string;
  readonly place: string;
  readonly title: string;
  readonly body: string;
  /** Der sichtbare Satz: wer spricht, an welchem Ort und was er weiss. */
  readonly text: string;
  /** Erinnerung an fruehere Begegnungen, aus dem gespeicherten Zustand. */
  readonly memory: string;
  readonly choices: NarrativeEventView['choices'];
  readonly status: string;
}

export function encounterDialog(world: WorldState, ledger: Ledger, eventId: number): EncounterDialog {
  const event = world.narrative.events.find((entry) => entry.id === eventId);
  if (!event) throw new Error(`Unbekannte Begegnung: ${String(eventId)}`);
  const { visitorId, npc } = encounterNpc(world, event);
  const view = buildNarrativeView(world, ledger).events.find((entry) => entry.id === eventId) ?? null;
  const title = view?.title ?? '';
  const body = view?.body ?? '';
  const name = npc.name;
  const role = npc.role;
  const place = locationName(npc.location);
  const seen = lastEncounter(world, visitorId);
  const edge = relationshipBetween(world, visitorRef(visitorId), 'player');
  const memory = seen
    ? `${name} erinnert sich an Tag ${seen.day}: ${ACTION_LABEL[seen.action]}; Vertrauen ${edge?.trust ?? 0}.`
    : `${name} hat dich hier noch nicht gesehen.`;
  return {
    eventId,
    event: event.eventId,
    speaker: name,
    role,
    place,
    title,
    body,
    text: `${name} (${role}, ${place}): ${title} ${body}`.trim(),
    memory,
    choices: view?.choices ?? [],
    status: event.status,
  };
}
