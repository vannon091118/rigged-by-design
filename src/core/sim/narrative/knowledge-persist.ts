/** Persistenz der Wissensstaende: sichere Defaults, Grenzen und Herkunfts-Fallbacks. */
import { KNOWLEDGE_CONFIG, SOURCE_KINDS, type KnowledgeConfig } from './knowledge-config';
import type { KnowledgeEntry, KnowledgeSourceKind } from './knowledge-types';
import { isActorRef } from './relationships';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** Sichert gespeichertes Wissen: unbekannte Quellenarten und kaputte Zahlen fallen raus. */
export function normalizeKnowledge(raw: unknown, config: KnowledgeConfig = KNOWLEDGE_CONFIG): KnowledgeEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: KnowledgeEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (!isActorRef(item.actor) || !isActorRef(item.subject) || !isActorRef(item.sourceActor)) continue;
    if (!SOURCE_KINDS.includes(item.sourceKind as KnowledgeSourceKind)) continue;
    if (typeof item.topic !== 'string' || item.topic.length === 0) continue;
    const numbers = [item.sentiment, item.confidence, item.distance, item.tick, item.factId, item.id]
      .map((value) => (Number.isFinite(value) ? Number(value) : NaN));
    if (numbers.some((value) => Number.isNaN(value))) continue;
    entries.push({
      id: Math.max(0, Math.floor(numbers[5]!)),
      actor: item.actor,
      topic: item.topic.slice(0, 32),
      subject: item.subject,
      sentiment: clamp(numbers[0]!, -1, 1),
      confidence: clamp(numbers[1]!, 0, 1),
      sourceKind: item.sourceKind as KnowledgeSourceKind,
      sourceActor: item.sourceActor,
      originActor: isActorRef(item.originActor) ? item.originActor : item.sourceActor,
      distance: Math.max(0, Math.floor(numbers[2]!)),
      observedTick: Number.isFinite(item.observedTick) ? Math.max(0, Math.floor(Number(item.observedTick))) : Math.max(0, Math.floor(numbers[3]!)),
      decayedTick: Number.isFinite(item.decayedTick) ? Math.max(0, Math.floor(Number(item.decayedTick))) : Math.max(0, Math.floor(numbers[3]!)),
      tick: Math.max(0, Math.floor(numbers[3]!)),
      factId: Math.max(0, Math.floor(numbers[4]!)),
    });
  }
  return entries.slice(-config.limits.maxEntries);
}
