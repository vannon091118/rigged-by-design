/**
 * Contract: domain-event v1.0
 * Event-Hülle mit Actor-/Zeit-Referenzen, Sequenz und Payload-Version.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */
import type { ActorId } from './actor-id';

export type EventId = string;
export type PayloadVersion = number;

/** Eingabe für {@link createDomainEvent}. */
export interface DomainEventInput<TPayload> {
  readonly eventType: string;
  /** Welt-Tick aus dem world-time Contract. */
  readonly tick: number;
  /** Welt-Tag aus dem world-time Contract. */
  readonly day: number;
  readonly actorId: ActorId;
  /**
   * Laufende Nummer innerhalb von (eventType, tick, actorId). Der Produzent
   * zählt sie je Scope hoch; dadurch bleiben gleichartige Events im selben
   * Tick unterscheidbar, ohne Uhr oder Zufall zu benutzen.
   */
  readonly sequence: number;
  readonly payloadVersion: PayloadVersion;
  readonly payload: TPayload;
}

/** Eine Event-Hülle: unveränderlich nach Erstellung. */
export interface DomainEvent<TPayload = unknown> {
  readonly eventId: EventId;
  readonly eventType: string;
  readonly tick: number;
  readonly day: number;
  readonly actorId: ActorId;
  readonly sequence: number;
  readonly payloadVersion: PayloadVersion;
  readonly payload: TPayload;
}

export const EVENT_ID_SEPARATOR = ':' as const;

/**
 * Baut die stabile Event-ID `<eventType>:<tick>:<actorId>:<sequence>`.
 *
 * Die Actor-ID trägt keinen Doppelpunkt (actor-id Contract, Präfix + Sequenz),
 * deshalb ist die ID ohne Escaping eindeutig zerlegbar.
 */
export function domainEventId(
  eventType: string,
  tick: number,
  actorId: ActorId,
  sequence: number,
): EventId {
  if (!eventType) throw new Error('domain-event: eventType darf nicht leer sein');
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`domain-event: ungültiger Tick ${String(tick)}`);
  }
  if (!actorId) throw new Error('domain-event: actorId darf nicht leer sein');
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error(`domain-event: ungültige Sequenz ${String(sequence)}`);
  }
  return [eventType, tick, actorId, sequence].join(EVENT_ID_SEPARATOR);
}

/** Erstellt eine neue Domain-Event-Hülle. */
export function createDomainEvent<TPayload>(input: DomainEventInput<TPayload>): DomainEvent<TPayload> {
  const eventId = domainEventId(input.eventType, input.tick, input.actorId, input.sequence);
  return Object.freeze({
    eventId,
    eventType: input.eventType,
    tick: input.tick,
    day: input.day,
    actorId: input.actorId,
    sequence: input.sequence,
    payloadVersion: input.payloadVersion,
    payload: input.payload,
  });
}

/** Prüft, ob eine Event-Hülle die Invarianten erfüllt. */
export function validateDomainEvent(event: DomainEvent): boolean {
  if (!event.eventId || typeof event.eventId !== 'string') return false;
  if (!event.eventType || typeof event.eventType !== 'string') return false;
  if (!event.actorId || typeof event.actorId !== 'string') return false;
  if (!Number.isSafeInteger(event.tick) || event.tick < 0) return false;
  if (!Number.isSafeInteger(event.day) || event.day < 0) return false;
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) return false;
  if (!Number.isSafeInteger(event.payloadVersion) || event.payloadVersion < 1) return false;
  try {
    return event.eventId === domainEventId(event.eventType, event.tick, event.actorId, event.sequence);
  } catch {
    return false;
  }
}
