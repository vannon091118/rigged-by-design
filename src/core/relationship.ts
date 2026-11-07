/**
 * Contract: Relationship (v1.0.0)
 * Visitor/guest/player relationship state with factors and dispositions.
 * Merged in Phase 0.5 as a baseline contract.
 */

export type Disposition = "hostile" | "neutral" | "friendly" | "intimate";

export interface Relationship {
  readonly actorId: string;
  readonly disposition: Disposition;
  readonly score: number; // -100..100
  readonly lastUpdatedTick: number;
}

export interface Factor {
  readonly id: string;
  readonly weight: number; // bps, -10000..10000
  readonly appliedAtTick: number;
}

export function createRelationship(
  actorId: string,
  disposition: Disposition = "neutral",
  score: number = 0
): Relationship {
  return {
    actorId,
    disposition,
    score: Math.max(-100, Math.min(100, score)),
    lastUpdatedTick: 0,
  };
}

export function applyFactor(
  rel: Relationship,
  factor: Factor,
  currentTick: number
): Relationship {
  const newScore = Math.max(-100, Math.min(100, rel.score + factor.weight / 100));
  let disposition = rel.disposition;
  if (newScore >= 75) disposition = "intimate";
  else if (newScore >= 25) disposition = "friendly";
  else if (newScore <= -25) disposition = "hostile";
  else disposition = "neutral";

  return {
    ...rel,
    disposition,
    score: newScore,
    lastUpdatedTick: currentTick,
  };
}