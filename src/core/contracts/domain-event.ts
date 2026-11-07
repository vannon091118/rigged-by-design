/**
 * Contract: domain-event v1.0
 * Event-Hülle mit Actor-/Zeit-Referenzen und Payload-Version.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

export type EventId = string;
export type PayloadVersion = number;

/** Eine Event-Hülle: unveränderlich nach Erstellung. */
export interface DomainEvent<TPayload = unknown> {
  readonly eventId: EventId;
  readonly actorId: string; // Referenz auf actor-id Contract
  readonly tick: number; // world.tick aus world-time Contract
  readonly day: number; // world.day aus world-time Contract
  readonly eventType: string;
  readonly payloadVersion: PayloadVersion;
  readonly payload: TPayload;
}

/** Erstellt eine neue Domain-Event-Hülle. */
export function createDomainEvent<TPayload>(
  actorId: string,
  tick: number,
  day: number,
  eventType: string,
  payloadVersion: PayloadVersion,
  payload: TPayload,
): DomainEvent<TPayload> {
  return {
    eventId: `${eventType}:${tick}:${actorId}`,
    actorId,
    tick,
    day,
    eventType,
    payloadVersion,
    payload,
  };
}

/** Prüft, ob eine Event-Hülle die Invarianten erfüllt. */
export function validateDomainEvent(event: DomainEvent): boolean {
  if (!event.eventId || typeof event.eventId !== 'string') return false;
  if (!event.actorId || typeof event.actorId !== 'string') return false;
  if (!Number.isSafeInteger(event.tick) || event.tick < 0) return false;
  if (!Number.isSafeInteger(event.day) || event.day < 0) return false;
  if (!event.eventType || typeof event.eventType !== 'string') return false;
  if (!Number.isSafeInteger(event.payloadVersion) || event.payloadVersion < 1) return false;
  return true;
}
