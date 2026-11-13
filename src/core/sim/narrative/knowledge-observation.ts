/**
 * Beobachtungsschicht: Eine Sicht oder ein Geraeusch setzt echte Anwesenheit
 * voraus; ohne lebenden Gast im Raum entsteht kein Eintrag. Gehoertes und
 * Gelesenes entsteht ausschliesslich ueber eine Weitergabe mit Quelle, nie
 * durch eine direkte Beobachtung.
 */
import type { WorldState } from '../types';
import type { ActorRef, Observation, ObservationChannel } from './knowledge-types';
import { visitorIdOf } from './relationships';
import { clamp } from '../num';

const OBSERVATION_CHANNELS: readonly ObservationChannel[] = [
  'SELBST', 'SICHT', 'GERAEUSCH', 'GESPRAECH', 'NACHRICHT', 'DOKUMENT',
];

const DIRECT_CHANNELS: readonly ObservationChannel[] = ['SICHT', 'GERAEUSCH'];

/** Ein Gast ist nur anwesend, solange er den Raum nicht verlassen hat. */
function isPresent(world: WorldState, actor: ActorRef): boolean {
  const visitorId = visitorIdOf(actor);
  if (visitorId === null || !Array.isArray(world.guests)) return false;
  return world.guests.some((guest) => guest.visitorId === visitorId && guest.state !== 'LEAVE');
}

interface ObservationInput {
  readonly actor: ActorRef;
  readonly factId: number;
  readonly channel: ObservationChannel;
  readonly tick: number;
  readonly quality: number;
}

/** Schreibt hoechstens eine Beobachtung je Fakt und Akteur; direkt nur bei Anwesenheit. */
export function noteObservation(world: WorldState, input: ObservationInput, maxEntries: number): Observation | null {
  if (!OBSERVATION_CHANNELS.includes(input.channel)) {
    throw new Error(`Beobachtung: unbekannter Kanal ${input.channel}.`);
  }
  if (!Number.isFinite(input.quality) || input.quality <= 0 || input.quality > 1) {
    throw new Error('Beobachtung: Qualitaet liegt ausserhalb 0..1.');
  }
  if (DIRECT_CHANNELS.includes(input.channel) && !isPresent(world, input.actor)) return null;
  const state = world.narrative;
  if (state.observations.some((entry) => entry.factId === input.factId && entry.actor === input.actor)) return null;
  const made: Observation = {
    id: state.observationSeq, actor: input.actor, factId: input.factId,
    channel: input.channel, tick: input.tick, quality: clamp(input.quality, 0, 1),
  };
  state.observationSeq += 1;
  state.observations.push(made);
  const overflow = state.observations.length - maxEntries;
  if (overflow > 0) state.observations.splice(0, overflow);
  return made;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Laedt nur schema-konforme Beobachtungen; kaputte Eintraege fallen still raus. */
export function normalizeObservations(raw: unknown, maxEntries = 160): Observation[] {
  if (!Array.isArray(raw)) return [];
  const entries: Observation[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const channel = item.channel as ObservationChannel;
    if (!OBSERVATION_CHANNELS.includes(channel)) continue;
    const numbers = [item.id, item.factId, item.tick, item.quality]
      .map((value) => (Number.isFinite(value) ? Number(value) : NaN));
    if (numbers.some((value) => Number.isNaN(value))) continue;
    if (numbers[3]! <= 0 || numbers[3]! > 1) continue;
    entries.push({
      id: Math.max(0, Math.floor(numbers[0]!)),
      actor: item.actor as ActorRef,
      factId: Math.max(0, Math.floor(numbers[1]!)),
      channel,
      tick: Math.max(0, Math.floor(numbers[2]!)),
      quality: clamp(numbers[3]!, 0, 1),
    });
  }
  return entries.slice(-maxEntries);
}
