/**
 * Wissenskette: Kein NPC berichtet, was er nicht selbst erlebt, gesehen, gehoert
 * oder gelesen hat. Jede Aussage traegt ihre Provenance (Quelle, Art, Distanz,
 * Tick). Mit jeder Weitergabe entscheidet ein seedfester Wurf ueber Verlust und
 * Verdrehung; derselbe Seed ergibt dieselbe Kette. Nichts hier wuerfelt global.
 */
import { Prng } from '../../rng/prng';
import type { WorldState } from '../types';
import {
  KNOWLEDGE_CONFIG, knowledgeRisk, sourceWeightOf, validateKnowledgeConfig,
  type KnowledgeConfig,
} from './knowledge-config';
import { relationshipBetween, shift } from './relationships';
import type { InfluenceValues } from '../influence';
import type { ActorRef, KnowledgeEntry } from './knowledge-types';
import { noteObservation } from './knowledge-observation';
import { willingToShare } from './knowledge-share';

export type SpeakerValues = Pick<InfluenceValues, 'mood' | 'sociability' | 'thirst' | 'rumor'>;

const KNOWLEDGE_TOPIC = 'haus';
const KNOWLEDGE_SUBJECT: ActorRef = 'player';
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function entryOf(world: WorldState, actor: ActorRef, topic: string, entryId?: number): KnowledgeEntry | null {
  const candidates = world.narrative.knowledge.filter((entry) => entry.actor === actor && entry.topic === topic);
  if (entryId !== undefined) return candidates.find((entry) => entry.id === entryId) ?? null;
  return candidates[candidates.length - 1] ?? null;
}

/** Kennt dieser Akteur ueberhaupt etwas zu diesem Thema? */
function knows(world: WorldState, actor: ActorRef, topic: string = KNOWLEDGE_TOPIC): boolean {
  return world.narrative.knowledge.some((entry) => entry.actor === actor && entry.topic === topic);
}

function append(world: WorldState, entry: Omit<KnowledgeEntry, 'id'>, config: KnowledgeConfig): KnowledgeEntry {
  const made: KnowledgeEntry = { ...entry, id: world.narrative.knowledgeSeq };
  world.narrative.knowledgeSeq += 1;
  world.narrative.knowledge.push(made);
  const overflow = world.narrative.knowledge.length - config.limits.maxEntries;
  if (overflow > 0) world.narrative.knowledge.splice(0, overflow);
  return made;
}

/** Erste Hand: die eigene Erfahrung, Distanz 0, volle Konfidenz. */
export function recordFirstHand(
  world: WorldState,
  input: { readonly actor: ActorRef; readonly factId: number; readonly sentiment: number; readonly tick: number },
  config: KnowledgeConfig = KNOWLEDGE_CONFIG,
): KnowledgeEntry | null {
  validateKnowledgeConfig(config);
  const sentiment = clamp(input.sentiment, -1, 1);
  if (Math.abs(sentiment) < 0.1) return null;
  if (world.narrative.knowledge.some((entry) => entry.factId === input.factId && entry.actor === input.actor)) return null;
  noteObservation(world, {
    actor: input.actor, factId: input.factId, channel: 'SELBST', tick: input.tick, quality: 1,
  }, config.limits.maxObservations);
  return append(world, {
    actor: input.actor, topic: KNOWLEDGE_TOPIC, subject: KNOWLEDGE_SUBJECT,
    sentiment, confidence: 1, sourceKind: 'ERLEBT', sourceActor: input.actor,
    originActor: input.actor, distance: 0, observedTick: input.tick, decayedTick: input.tick,
    tick: input.tick, factId: input.factId,
  }, config);
}

interface SightingInput {
  readonly actor: ActorRef;
  readonly factId: number;
  readonly sentiment: number;
  readonly channel: 'SICHT' | 'GERAEUSCH';
  readonly quality: number;
  readonly tick: number;
}

/** Eigene Beobachtung: ohne Anwesenheit kein Eintrag; die Qualitaet ist die Konfidenz. */
export function recordSighting(
  world: WorldState,
  input: SightingInput,
  config: KnowledgeConfig = KNOWLEDGE_CONFIG,
): KnowledgeEntry | null {
  validateKnowledgeConfig(config);
  const sentiment = clamp(input.sentiment, -1, 1);
  if (Math.abs(sentiment) < 0.1) return null;
  if (world.narrative.knowledge.some((entry) => entry.factId === input.factId && entry.actor === input.actor)) return null;
  const observation = noteObservation(world, {
    actor: input.actor, factId: input.factId, channel: input.channel,
    tick: input.tick, quality: input.quality,
  }, config.limits.maxObservations);
  if (!observation) return null;
  return append(world, {
    actor: input.actor, topic: KNOWLEDGE_TOPIC, subject: KNOWLEDGE_SUBJECT,
    sentiment, confidence: observation.quality,
    sourceKind: input.channel === 'SICHT' ? 'GESEHEN' : 'GEHOERT',
    sourceActor: input.actor, originActor: input.actor, distance: 0,
    observedTick: input.tick, decayedTick: input.tick, tick: input.tick, factId: input.factId,
  }, config);
}

interface ReportInput {
  readonly from: ActorRef;
  readonly to: ActorRef;
  readonly topic?: string;
  readonly entryId?: number;
  readonly tick: number;
  readonly seed: number;
  /** Optional: wer erzaehlt, muss laut Matrix ueberhaupt weitergabebereit sein. */
  readonly speaker?: SpeakerValues;
}

/** Beziehung Sprecher -> Empfaenger fliesst als Faktoren in die Weitergabe-Matrix. */
function speakerInfluence(world: WorldState, from: ActorRef, to: ActorRef, base: SpeakerValues): InfluenceValues {
  const edge = relationshipBetween(world, from, to) ?? relationshipBetween(world, to, from);
  return {
    ...base,
    trust: edge?.trust ?? 0,
    sympathy: edge?.sympathy ?? 0,
    conflict: edge?.conflict ?? 0,
  };
}

/**
 * Weitergabe: Der Sprecher muss den Eintrag selbst besitzen, sonst wird der
 * Bericht fail-closed abgelehnt - nicht mit geringer Wahrscheinlichkeit erlaubt.
 * null heisst: unterwegs verloren oder unter der Mindestkonfidenz.
 */
export function reportKnowledge(
  world: WorldState,
  input: ReportInput,
  config: KnowledgeConfig = KNOWLEDGE_CONFIG,
): KnowledgeEntry | null {
  validateKnowledgeConfig(config);
  if (input.from === input.to) throw new Error('Wissenskette: niemand berichtet sich selbst.');
  const topic = input.topic ?? KNOWLEDGE_TOPIC;
  if (!knows(world, input.from, topic)) {
    throw new Error(`Wissenskette: ${input.from} hat kein Wissen zu ${topic}; Bericht abgelehnt.`);
  }
  const entry = entryOf(world, input.from, topic, input.entryId);
  if (!entry) throw new Error(`Wissenskette: ${input.from} hat kein Wissen zu ${topic}; Bericht abgelehnt.`);
  if (entry.actor !== input.from) throw new Error('Wissenskette: Quelle und Wissensbesitzer stimmen nicht ueberein.');
  if (input.speaker && !willingToShare(speakerInfluence(world, input.from, input.to, input.speaker))) return null;
  return transmit(world, entry, input.to, input.tick, input.seed, config);
}

function transmit(
  world: WorldState,
  entry: KnowledgeEntry,
  to: ActorRef,
  tick: number,
  seed: number,
  config: KnowledgeConfig,
): KnowledgeEntry | null {
  const distance = entry.distance + 1;
  if (distance > config.distance.maxDistance) return null;
  const risk = knowledgeRisk(config, distance);
  // Eigener Strom je Kette: derselbe Seed reproduziert Verlust und Verdrehung.
  const prng = new Prng(seed);
  if (prng.nextFloat() < risk.loss) return null;
  const edge = relationshipBetween(world, to, entry.sourceActor)
    ?? relationshipBetween(world, entry.sourceActor, to);
  const weight = sourceWeightOf(config, entry.sourceKind === 'ERLEBT' ? 'GEHOERT' : entry.sourceKind, edge);
  const confidence = entry.confidence * weight * (1 - config.distance.confidenceDecay * distance);
  if (confidence < config.limits.minConfidence) return null;
  const distorted = prng.nextFloat() < risk.distortion;
  const made = append(world, {
    actor: to, topic: entry.topic, subject: entry.subject,
    sentiment: distorted ? clamp(-entry.sentiment * 0.8, -1, 1) : entry.sentiment,
    confidence, sourceKind: entry.sourceKind === 'ERLEBT' ? 'GEHOERT' : entry.sourceKind,
    sourceActor: entry.actor, originActor: entry.originActor, distance,
    observedTick: entry.observedTick, decayedTick: tick, tick, factId: entry.factId,
  }, config);
  // Rueckwirkung: Die Quelle gewinnt Vertrauen, das Subjekt gewinnt oder verliert Sympathie.
  shift(world, to, entry.actor, {
    trust: config.feedback.sourceTrust * (made.confidence >= 0.3 ? 1 : -0.5),
  }, tick);
  if (entry.subject !== to) {
    const sympathy = clamp(made.sentiment * made.confidence * config.feedback.subjectSympathy, -2, 2);
    shift(world, to, entry.subject, { sympathy }, tick);
  }
  return made;
}

/** Abfragen und Alterung liegen getrennt; die Fassade bleibt importierbar. */
export { ageKnowledge, contradictionsAbout, entriesAbout, rumorAbout } from './knowledge-query';

export { normalizeKnowledge } from './knowledge-persist';
