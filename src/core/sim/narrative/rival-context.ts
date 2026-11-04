/**
 * Phase 5: Rivalen-Karten als reine Ableitung aus den persistenten Minds.
 * Einzige Grundlage sind `RivalMindState` (Haltung, Kapazitaet, Wohlwollen,
 * naechster Zug), `evidence` (Indizien, 4) und `history` (6) sowie
 * `counteredUntilTick` aus der D2-Gegenmassnahme. Kein neuer Zustand, keine
 * NAR-14-17-Duplikate; `view.ts` bleibt durch diesen Helper unter 200 Zeilen.
 */
import {
  RIVAL_AI_LIMITS, type RivalActionRecord, type RivalEvidence, type RivalMindState,
} from '../rival-ai/types';
import { RIVAL_IDS, type RivalId } from '../types-model';
import type { WorldState } from '../types';
import type { NarrativeRivalView } from './view-types';

const orderOf = (rivalId: RivalId): number => {
  const index = (RIVAL_IDS as readonly string[]).indexOf(rivalId);
  return index < 0 ? RIVAL_IDS.length : index;
};

const evidenceOf = (mind: RivalMindState): readonly RivalEvidence[] =>
  mind.evidence.slice(-RIVAL_AI_LIMITS.evidence).map((entry) => ({ ...entry }));

const historyOf = (mind: RivalMindState): readonly RivalActionRecord[] =>
  mind.history.slice(-RIVAL_AI_LIMITS.history).map((entry) => ({ ...entry }));

/** Eine Karte je Rivale in kanonischer Reihenfolge; Kopien statt Referenzen. */
export function rivalViews(world: WorldState): NarrativeRivalView[] {
  return [...world.rivals]
    .sort((left, right) => orderOf(left.rivalId) - orderOf(right.rivalId))
    .map((mind) => ({
      rivalId: mind.rivalId,
      stance: mind.stance,
      capacity: mind.capacity,
      goodwill: mind.goodwill,
      countered: mind.counteredUntilTick > world.tick,
      counteredTicksLeft: Math.max(0, mind.counteredUntilTick - world.tick),
      nextActionTick: mind.nextActionTick,
      evidence: evidenceOf(mind),
      history: historyOf(mind),
    }));
}
