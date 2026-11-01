/** Charaktergedaechtnis: aus Facts werden strukturierte Erinnerungen und messbare Wirkung. */
import type { Visitor, WorldState } from '../types';
import { drainFacts, pushRecent } from './facts';
import { NARRATIVE_LIMITS, type VisitEndedFact, type VisitorMemory, type VisitorValence } from './types';

const GOOD_RETURN = 4;
const BAD_RETURN = -6;
const GOOD_MOOD = 6;
const BAD_MOOD = -4;

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

/** Verarbeitet die Queue: Erinnerungen schreiben, Zaehler fortschreiben. Gibt die Zahl neuer Erinnerungen zurueck. */
export function processFacts(world: WorldState): number {
  const fresh = drainFacts(world);
  if (fresh.length === 0) return 0;
  let applied = 0;
  for (const fact of fresh) {
    if (fact.kind === 'VISIT_ENDED' && remember(world, fact)) applied += 1;
    if (fact.kind === 'VISITOR_RETURNED') world.narrative.flags.rueckkehrer = (world.narrative.flags.rueckkehrer ?? 0) + 1;
    if (fact.kind === 'VISITOR_FIRST_SEEN') world.narrative.flags.neue_gaeste = (world.narrative.flags.neue_gaeste ?? 0) + 1;
    if (fact.kind === 'START_POOL') world.narrative.flags.startpool = (world.narrative.flags.startpool ?? 0) + 1;
  }
  pushRecent(world, fresh);
  return applied;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/**
 * Wirkung der Erinnerungen: die letzte zaehlt doppelt, damit ein Praegendes den Ausschlag gibt.
 * Rein deterministisch aus gespeicherten Daten, ohne PRNG.
 */
export function memoryEffect(visitor: Visitor): { readonly returnBonus: number; readonly moodBonus: number } {
  const memories: readonly VisitorMemory[] = visitor.memories ?? [];
  let returnBonus = 0;
  let moodBonus = 0;
  for (const [index, memory] of memories.entries()) {
    const weight = index === memories.length - 1 ? 2 : 1;
    if (memory.valence === 'GOOD') {
      returnBonus += GOOD_RETURN * weight;
      moodBonus += GOOD_MOOD * weight;
    } else if (memory.valence === 'BAD') {
      returnBonus += BAD_RETURN * weight;
      moodBonus += BAD_MOOD * weight;
    }
  }
  return { returnBonus: clamp(returnBonus, -12, 12), moodBonus: clamp(moodBonus, -8, 10) };
}
