/** Abfragen auf der Wissensdomäne: Glaube, Widersprueche und Alterung. */
import type { WorldState } from '../types';
import { KNOWLEDGE_CONFIG, type KnowledgeConfig } from './knowledge-config';
import type { ActorRef, KnowledgeEntry } from './knowledge-types';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
/** Untergrenze fuer eigene Erfahrung: sie verblasst, verschwindet aber nie. */
const EXPERIENCED_FLOOR = 0.5;

/** Alle Staende eines Akteurs zu einem Thema; Widersprueche bleiben einzeln erhalten. */
export function entriesAbout(world: WorldState, actor: ActorRef, subject: ActorRef = 'player'): KnowledgeEntry[] {
  return world.narrative.knowledge.filter((entry) => entry.actor === actor && entry.subject === subject);
}

/** Konfidenzgewichteter Glaube: -1..1; widerspruechliche Quellen heben sich auf. */
export function rumorAbout(world: WorldState, actor: ActorRef, subject: ActorRef = 'player'): number {
  let sum = 0;
  let weights = 0;
  for (const entry of entriesAbout(world, actor, subject)) {
    sum += entry.sentiment * entry.confidence;
    weights += entry.confidence;
  }
  return weights > 0 ? clamp(sum / weights, -1, 1) : 0;
}

/** Paare mit entgegengesetzter Aussage; beide Herkuenfte bleiben sichtbar. */
export function contradictionsAbout(
  world: WorldState,
  actor: ActorRef,
  subject: ActorRef = 'player',
): ReadonlyArray<readonly [KnowledgeEntry, KnowledgeEntry]> {
  const entries = entriesAbout(world, actor, subject).filter((entry) => Math.abs(entry.sentiment) >= 0.1);
  const pairs: Array<readonly [KnowledgeEntry, KnowledgeEntry]> = [];
  for (let first = 0; first < entries.length; first += 1) {
    for (let second = first + 1; second < entries.length; second += 1) {
      if (Math.sign(entries[first]!.sentiment) !== Math.sign(entries[second]!.sentiment)) {
        pairs.push([entries[first]!, entries[second]!]);
      }
    }
  }
  return pairs;
}

/**
 * Alterung: je Tick hoechstens einmal, linear seit dem letzten Schritt und
 * unterhalb der Mindestkonfidenz verworfen. Gleiche Eingaben, gleiches Ergebnis.
 */
export function ageKnowledge(world: WorldState, nowTick: number, config: KnowledgeConfig = KNOWLEDGE_CONFIG): number {
  if (world.narrative.flags.knowledgeAgedTick === nowTick) return 0;
  world.narrative.flags.knowledgeAgedTick = nowTick;
  const kept: KnowledgeEntry[] = [];
  let dropped = 0;
  for (const entry of world.narrative.knowledge) {
    const age = nowTick - entry.observedTick;
    const last = entry.decayedTick;
    if (nowTick <= last) {
      kept.push(entry);
    } else if (age <= config.aging.graceTicks) {
      kept.push({ ...entry, decayedTick: nowTick });
    } else {
      const confidence = entry.confidence - config.aging.decayPerTick * (nowTick - last);
      // Eigene Erfahrung ist die Wurzel jeder Weitergabe: sie faellt bis zur Untergrenze,
      // aber nie darunter. Gehoertes und Gesehenes verschwindet unter der Mindestkonfidenz.
      if (entry.sourceKind === 'ERLEBT' && confidence < EXPERIENCED_FLOOR) {
        kept.push({ ...entry, confidence: EXPERIENCED_FLOOR, decayedTick: nowTick });
      } else if (confidence < config.aging.minConfidence) dropped += 1;
      else kept.push({ ...entry, confidence, decayedTick: nowTick });
    }
  }
  world.narrative.knowledge = kept;
  return dropped;
}
