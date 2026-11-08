/**
 * Geruechtquelle: Ein zurueckkehrender Gast hoert nicht einfach den neuesten
 * Eintrag, sondern die Quelle, zu der er die staerkste Beziehung hat und die
 * laut Matrix ueberhaupt erzaehlen will. Bleibt eine bereit, wird die naechste
 * deterministisch versucht; kein globaler RNG wird verschoben.
 */
import type { WorldState } from '../types';
import { KNOWLEDGE_CONFIG, type KnowledgeConfig } from './knowledge-config';
import { reportKnowledge, rumorAbout, type SpeakerValues } from './knowledge';
import type { ActorRef, KnowledgeEntry } from './knowledge-types';
import { relationshipBetween, visitorIdOf } from './relationships';

function actorHash(actor: ActorRef): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < actor.length; index += 1) {
    hash ^= actor.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Wie nahe steht der Empfaenger dieser Quelle? Die drei Gewichte sind Teil der
 * Knowledge-Config, damit dieselbe Rangfolge balancebar bleibt.
 */
export function gossipStanding(
  world: WorldState,
  target: ActorRef,
  source: ActorRef,
  config: KnowledgeConfig = KNOWLEDGE_CONFIG,
): number {
  const edge = relationshipBetween(world, target, source) ?? relationshipBetween(world, source, target);
  if (!edge) return 0;
  return edge.trust * config.gossip.trust
    + edge.sympathy * config.gossip.sympathy
    - edge.conflict * config.gossip.conflict;
}

/** Zustand des Sprechers, sofern er gerade im Raum steht; sonst neutrale Basis. */
function speakerBase(world: WorldState, actor: ActorRef): SpeakerValues {
  const id = visitorIdOf(actor);
  const guest = id === null ? undefined : world.guests.find((entry) => entry.visitorId === id && entry.state !== 'LEAVE');
  return {
    mood: guest?.mood ?? 50,
    sociability: guest?.sociability ?? 50,
    thirst: guest?.thirst ?? 0,
    rumor: rumorAbout(world, actor),
  };
}

export function hearRumor(
  world: WorldState,
  target: ActorRef,
  tick: number,
  config: KnowledgeConfig = KNOWLEDGE_CONFIG,
): KnowledgeEntry | null {
  const byActor = new Map<ActorRef, KnowledgeEntry>();
  for (const entry of world.narrative.knowledge) {
    if (entry.actor === target || entry.topic !== 'haus') continue;
    const current = byActor.get(entry.actor);
    if (!current || current.id < entry.id) byActor.set(entry.actor, entry);
  }
  const ranked = [...byActor.values()]
    .map((entry) => ({ entry, standing: gossipStanding(world, target, entry.actor, config) }))
    .sort((first, second) => second.standing - first.standing || second.entry.id - first.entry.id);

  for (const { entry } of ranked) {
    const heard = reportKnowledge(world, {
      from: entry.actor,
      to: target,
      entryId: entry.id,
      tick,
      seed: (Math.imul(entry.id + 1, 2654435761) + actorHash(target) + tick) >>> 0,
      speaker: speakerBase(world, entry.actor),
    }, config);
    if (heard) return heard;
  }
  return null;
}
