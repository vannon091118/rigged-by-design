/** Fact-Queue: typisierte, einmalige Ereignisse mit stabiler ID — getrennt vom Journal. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { PersonaId, WorldState } from '../types';
import { NARRATIVE_LIMITS, type NarrativeFact } from './types';

type FactDraft =
  | { readonly kind: 'START_POOL'; readonly visitorId: number; readonly capital: VaCoinMicro }
  | { readonly kind: 'VISITOR_FIRST_SEEN'; readonly visitorId: number; readonly persona: PersonaId }
  | { readonly kind: 'VISITOR_RETURNED'; readonly visitorId: number; readonly visits: number }
  | { readonly kind: 'VISIT_ENDED'; readonly visitorId: number; readonly guestId: number; readonly score: number; readonly valence: 'GOOD' | 'NEUTRAL' | 'BAD' };

/** Haengt einen Fact mit naechster ID, Tick und Tag an die Queue; aelteste fallen bei Ueberlauf. */
export function emitFact(world: WorldState, draft: FactDraft): NarrativeFact {
  const fact = { ...draft, id: world.narrative.factSeq, tick: world.tick, day: world.day } as NarrativeFact;
  world.narrative.factSeq += 1;
  world.narrative.pending.push(fact);
  const overflow = world.narrative.pending.length - NARRATIVE_LIMITS.pending;
  if (overflow > 0) {
    world.narrative.pending.splice(0, overflow);
    world.narrative.dropped += overflow;
  }
  return fact;
}

/**
 * Gibt alle noch nicht verarbeiteten Facts zurueck und leert die Queue.
 * Ein zweiter Aufruf liefert nichts: dieselbe ID wird nie doppelt verarbeitet.
 */
export function drainFacts(world: WorldState): NarrativeFact[] {
  const state = world.narrative;
  const fresh = state.pending.filter((fact) => fact.id > state.processedId);
  state.pending = [];
  const last = fresh[fresh.length - 1];
  if (last) state.processedId = last.id;
  return fresh;
}

/** Haelt die Kurzzeithistorie begrenzt und in ID-Reihenfolge. */
export function pushRecent(world: WorldState, facts: readonly NarrativeFact[]): void {
  const state = world.narrative;
  for (const fact of facts) {
    if (state.recent.some((entry) => entry.id === fact.id)) continue;
    state.recent.push(fact);
  }
  const overflow = state.recent.length - NARRATIVE_LIMITS.recent;
  if (overflow > 0) state.recent.splice(0, overflow);
}

export function recentFacts(world: WorldState, kind: NarrativeFact['kind']): readonly NarrativeFact[] {
  return world.narrative.recent.filter((fact) => fact.kind === kind);
}
