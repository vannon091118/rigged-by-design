/**
 * Contract: Domain-Event (v1.0.0)
 * Typed domain events with deadlines, pending caps, and visitor/guest/player
 * state transitions. Merged in Phase 0.5 as a baseline contract.
 */

export type EventType =
  | "visitor.arrived"
  | "visitor.departed"
  | "guest.checked-in"
  | "guest.checked-out"
  | "player.cash-changed"
  | "player.cash-out"
  | "relationship.changed"
  | "blackjack.settled"
  | "slot.spin"
  | "custom";

export interface DomainEvent<E extends EventType = EventType> {
  readonly id: string;
  readonly type: E;
  readonly actorId: string;
  readonly payload: Record<string, unknown>;
  readonly deadlineTick: number;   // absolute tick by which event must resolve
  readonly createdAtTick: number;
  readonly resolved: boolean;
}

export interface EventContext {
  readonly maxPending: number;     // 48
  readonly maxNewEventsPerTick: number; // 3
  readonly visitorCap: number;     // 40
  readonly maxCandidates: number;  // 64
}

export const DEFAULT_EVENT_CONTEXT: EventContext = {
  maxPending: 48,
  maxNewEventsPerTick: 3,
  visitorCap: 40,
  maxCandidates: 64,
};

export function createDomainEvent<E extends EventType>(
  id: string,
  type: E,
  actorId: string,
  payload: Record<string, unknown>,
  createdAtTick: number,
  deadlineOffsetTicks: number
): DomainEvent<E> {
  return {
    id,
    type,
    actorId,
    payload,
    deadlineTick: createdAtTick + deadlineOffsetTicks,
    createdAtTick,
    resolved: false,
  };
}

export function isEventExpired(event: DomainEvent, currentTick: number): boolean {
  return currentTick >= event.deadlineTick;
}

export function isEventResolved(event: DomainEvent): boolean {
  return event.resolved;
}