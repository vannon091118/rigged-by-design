/**
 * Contract: Actor-ID (v1.0.0)
 * Stable, opaque identifier for actors in the life-sim domain.
 * Merged in Phase 0.5 as a baseline contract.
 */

export interface ActorId {
  readonly brand: unique symbol;
  readonly value: string;
}

export function createActorId(value: string): ActorId {
  if (!value || typeof value !== "string") {
    throw new Error("ActorId must be a non-empty string");
  }
  return { brand: Symbol("ActorId"), value };
}

export function actorIdEquals(a: ActorId, b: ActorId): boolean {
  return a.value === b.value;
}

export function actorIdToString(id: ActorId): string {
  return id.value;
}