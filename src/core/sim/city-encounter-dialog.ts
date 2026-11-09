/** Die Begegnung als Spieltext: Sprecher, Rolle, Ort und gespeicherte Erinnerung. */
import type { Ledger } from '../economy/ledger';
import { cityOf } from './city-model';
import { locationName, npcByName } from './city-npcs';
import type { NarrativeEventInstance } from './narrative/event-types';
import type { NarrativeEventView } from './narrative/view-types';
import { buildNarrativeView } from './narrative/view';
import { relationshipBetween } from './narrative/relationships';
import type { CityEncounterRecord, EncounterAction } from './city-types';
import type { WorldState } from './types';

export const ACTION_LABEL: Readonly<Record<EncounterAction, string>> = {
  GEBEN: 'eine Runde ausgegeben',
  HELFEN: 'mit angepackt',
  ABLEHNEN: 'die Bitte abgelehnt',
};

export const visitorRef = (id: number): `visitor:${number}` => `visitor:${id}`;

export const visitorIdOfEvent = (event: NarrativeEventInstance): number | null => {
  const ref = event.participants[0];
  const match = ref ? /^visitor:(\d+)$/.exec(ref) : null;
  return match ? Number(match[1]) : null;
};

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
  const npcId = visitorIdOfEvent(event);
  const visitor = npcId === null ? null : world.visitors.find((entry) => entry.id === npcId) ?? null;
  const def = visitor ? npcByName(visitor.name) : null;
  const view = buildNarrativeView(world, ledger).events.find((entry) => entry.id === eventId) ?? null;
  const title = view?.title ?? '';
  const body = view?.body ?? '';
  const name = visitor?.name ?? def?.name ?? 'Unbekannt';
  const role = def?.role ?? 'Bekanntschaft';
  const place = locationName(def?.location ?? cityOf(world).location);
  const seen = npcId === null ? null : lastEncounter(world, npcId);
  const edge = npcId === null ? null : relationshipBetween(world, visitorRef(npcId), 'player');
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
