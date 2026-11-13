/** Reine Speicherhelfer der Wissenskette: finden, pruefen, anhaengen. */
import type { WorldState } from '../types';
import type { KnowledgeConfig } from './knowledge-config';
import type { ActorRef, KnowledgeEntry } from './knowledge-types';

/** Den passenden Eintrag eines Akteurs zu einem Thema finden. */
export function knowledgeEntryOf(
  world: WorldState, actor: ActorRef, topic: string, entryId?: number,
): KnowledgeEntry | null {
  const candidates = world.narrative.knowledge.filter((entry) => entry.actor === actor && entry.topic === topic);
  return entryId !== undefined
    ? candidates.find((entry) => entry.id === entryId) ?? null
    : candidates[candidates.length - 1] ?? null;
}

/** Hat der Akteur bereits Wissen zu diesem Thema? */
export function knowsKnowledge(world: WorldState, actor: ActorRef, topic: string): boolean {
  return world.narrative.knowledge.some((entry) => entry.actor === actor && entry.topic === topic);
}

/** Eintrag mit fortlaufender ID anhaengen und die Obergrenze einhalten. */
export function appendKnowledge(
  world: WorldState, entry: Omit<KnowledgeEntry, 'id'>, config: KnowledgeConfig,
): KnowledgeEntry {
  const made: KnowledgeEntry = { ...entry, id: world.narrative.knowledgeSeq };
  world.narrative.knowledgeSeq += 1;
  world.narrative.knowledge.push(made);
  const overflow = world.narrative.knowledge.length - config.limits.maxEntries;
  if (overflow > 0) world.narrative.knowledge.splice(0, overflow);
  return made;
}
