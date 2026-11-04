/** Charaktergedaechtnis: aus Facts werden strukturierte Erinnerungen und messbare Wirkung. */
import type { Visitor, WorldState } from '../types';
import { scoreMemories, type MemoryScore } from './disposition';
import { NARRATIVE_LIMITS, type NarrativeFact, type VisitEndedFact, type VisitorValence } from './types';

/** Dieselbe Schwelle wie die Zufriedenheitsnotiz: 65+ ist ein guter Besuch, 35- ein schlechter. */
export function valenceOf(score: number): VisitorValence {
  if (score >= 65) return 'GOOD';
  if (score <= 35) return 'BAD';
  return 'NEUTRAL';
}

/** Schreibt eine Erinnerung genau einmal je Fact; unbekannte Besucher werden sicher ignoriert. */
function remember(world: WorldState, fact: VisitEndedFact): boolean {
  const visitor = world.visitors.find((entry) => entry.id === fact.visitorId);
  if (!visitor) return false;
  if (!Array.isArray(visitor.memories)) visitor.memories = [];
  if (visitor.memories.some((memory) => memory.factId === fact.id)) return false;
  visitor.memories.push({ factId: fact.id, tick: fact.tick, score: fact.score, valence: fact.valence });
  if (visitor.memories.length > NARRATIVE_LIMITS.memories) {
    visitor.memories.splice(0, visitor.memories.length - NARRATIVE_LIMITS.memories);
  }
  return true;
}

/** Schreibt Erinnerungen und Zaehler; die Queue wird ausschliesslich im Boundary gedraint. */
export function applyMemories(world: WorldState, fresh: readonly NarrativeFact[]): number {
  let applied = 0;
  for (const fact of fresh) {
    if (fact.kind === 'VISIT_ENDED' && remember(world, fact)) applied += 1;
    if (fact.kind === 'VISITOR_RETURNED') world.narrative.flags.rueckkehrer = (world.narrative.flags.rueckkehrer ?? 0) + 1;
    if (fact.kind === 'VISITOR_FIRST_SEEN') world.narrative.flags.neue_gaeste = (world.narrative.flags.neue_gaeste ?? 0) + 1;
  }
  return applied;
}

/**
 * Wirkung der Erinnerungen als duenne Fassade ueber `scoreMemories()` aus
 * `disposition.ts`, damit es keine zweite Gedaechtnislogik gibt. Die Disposition
 * nutzt dieselbe Wertung fuer Spiel-, Service- und Sozialneigung; die Rueckkehr
 * behaelt zusaetzlich den Beziehungszuschlag aus `returnBias`.
 */
export function memoryEffect(visitor: Visitor): { readonly returnBonus: number; readonly moodBonus: number } {
  const score: MemoryScore = scoreMemories(visitor.memories ?? []);
  return { returnBonus: score.returnPoints, moodBonus: score.moodPoints };
}
