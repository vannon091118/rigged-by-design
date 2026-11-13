/**
 * @module city-life-targets — Anwesende, Ziele und nahe Personen
 *
 * Die Zielwahl ist raeumlich: eine Alternative findet nur statt, wenn Ort und
 * anwesende Person existieren. Diese Ableitung teilen Score und Entscheidung.
 */
import type { CityLifePlace, CityResidentState, NpcMemory } from './city-life-types';
import type { NpcIntentKind } from './npc-types';

interface CityTargetInput {
  readonly resident: CityResidentState;
  readonly peers: readonly CityResidentState[];
}

interface CityFriend {
  readonly peer: CityResidentState;
  readonly relation: number;
  readonly memory: NpcMemory | null;
}

export function bestFriend(input: CityTargetInput): CityFriend | null {
  let best: CityFriend | null = null;
  for (const peer of input.peers) {
    if (peer.npcId === input.resident.npcId) continue;
    const relation = input.resident.relationships[peer.npcId] ?? 0;
    const memory = memoryAbout(input.resident, peer.npcId);
    const social = memory && memory.kind !== 'MEAL' ? memory : null;
    if (relation < 3 && !social) continue;
    if (!best || relation > best.relation) best = { peer, relation, memory: social };
  }
  return best;
}

export function memoryAbout(resident: CityResidentState, npcId: string): NpcMemory | null {
  return [...resident.memories].reverse().find((entry) => entry.aboutNpcId === npcId) ?? null;
}

export function locationForIntent(
  intent: NpcIntentKind, workplace: CityLifePlace, target: CityResidentState | null,
): CityLifePlace {
  if (intent === 'VISIT_FRIEND' && target) return target.location;
  if (intent === 'WORK' || intent === 'COMMUTE' || intent === 'EAT_OUT' || intent === 'SHOP') return workplace;
  if (intent === 'PUB' || intent === 'LEISURE' || intent === 'VISIT_FRIEND') return 'KIEZ';
  return 'HOME';
}

export function presentAt(
  peers: readonly CityResidentState[], location: CityLifePlace, excludeId?: string,
): readonly string[] {
  return peers.filter((peer) => peer.location === location && peer.npcId !== excludeId)
    .map((peer) => peer.npcId).sort();
}
