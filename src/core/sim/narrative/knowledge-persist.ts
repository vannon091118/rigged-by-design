/** Persistenz der Wissensstaende: sichere Defaults, Grenzen und Herkunfts-Fallbacks. */
import { KNOWLEDGE_CONFIG, SOURCE_KINDS, type KnowledgeConfig } from './knowledge-config';
import type { ExchangeReason, KnowledgeEntry, KnowledgeExchange, KnowledgeSourceKind } from './knowledge-types';
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

/** Laedt nur schema-konforme Austausch-Begruendungen; kaputte Eintraege entfallen. */
export function normalizeExchanges(raw: unknown, maxEntries = 200): KnowledgeExchange[] {
  if (!Array.isArray(raw)) return [];
  const entries: KnowledgeExchange[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (!isActorRef(item.from) || !isActorRef(item.to)) continue;
    if (typeof item.shared !== 'boolean') continue;
    if (item.accepted !== null && typeof item.accepted !== 'boolean') continue;
    const numbers = [item.id, item.tick, item.seed, item.factId, item.score, item.threshold]
      .map((value) => (Number.isFinite(value) ? Number(value) : NaN));
    if (numbers.some((value) => Number.isNaN(value))) continue;
    const reasons: ExchangeReason[] = [];
    if (Array.isArray(item.reasons)) {
      for (const candidate of item.reasons.slice(0, 24)) {
        if (!isRecord(candidate) || typeof candidate.code !== 'string' || !Number.isFinite(candidate.delta)) continue;
        reasons.push({
          code: candidate.code.slice(0, 48),
          delta: Number(candidate.delta),
          detail: typeof candidate.detail === 'string' ? candidate.detail.slice(0, 160) : '',
        });
      }
    }
    entries.push({
      id: Math.max(0, Math.floor(numbers[0]!)),
      tick: Math.max(0, Math.floor(numbers[1]!)),
      seed: Math.max(0, Math.floor(numbers[2]!)),
      from: item.from,
      to: item.to,
      factId: Math.max(0, Math.floor(numbers[3]!)),
      shared: item.shared,
      accepted: item.accepted,
      score: clamp(numbers[4]!, 0, 2),
      threshold: clamp(numbers[5]!, 0, 2),
      reasons,
      entryId: Number.isFinite(item.entryId) ? Math.max(0, Math.floor(Number(item.entryId))) : null,
    });
  }
  return entries.slice(-maxEntries);
}
