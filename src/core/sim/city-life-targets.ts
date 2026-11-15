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

/**
 * Ortsindex einer Bewohnerliste. Er wird einmal pro Entscheidung gebaut,
 * damit `presentAt()` nicht in jeder Intent-Alternative erneut die gesamte
 * Liste nach `peer.location` filtern muss.
 */
export interface CityPeerIndex {
  readonly byLocation: ReadonlyMap<CityLifePlace, readonly CityResidentState[]>;
  readonly idsByLocation: ReadonlyMap<CityLifePlace, readonly string[]>;
}

export const EMPTY_CITY_PEER_INDEX: CityPeerIndex = {
  byLocation: new Map(),
  idsByLocation: new Map(),
};

export function buildCityPeerIndex(peers: readonly CityResidentState[]): CityPeerIndex {
  const byLocation = new Map<CityLifePlace, CityResidentState[]>();
  for (const peer of peers) {
    const list = byLocation.get(peer.location);
    if (list) list.push(peer);
    else byLocation.set(peer.location, [peer]);
  }
  const idsByLocation = new Map<CityLifePlace, readonly string[]>();
  for (const [location, list] of byLocation) {
    idsByLocation.set(location, list.map((peer) => peer.npcId).sort());
  }
  return { byLocation, idsByLocation };
}

export function presentIn(
  index: CityPeerIndex, location: CityLifePlace, excludeId?: string,
): readonly string[] {
  const ids = index.idsByLocation.get(location) ?? [];
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
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

/**
 * Ziel eines Intents. Das konkrete Ziel kommt aus dem Tagesplan
 * (`scheduledPlace`), damit ein Heimweg nach Schichtende nicht pauschal zum
 * Arbeitsplatz fuehrt und ein Einkauf nicht im Casino landet. Der Aufrufer
 * reicht `scheduledPlace` nur fuer die geplante Absicht herein; eine
 * Beduerfnis-Alternative erbt das Ziel der geplanten Absicht nicht.
 */
export function locationForIntent(
  intent: NpcIntentKind, workplace: CityLifePlace, target: CityResidentState | null,
  scheduledPlace: CityLifePlace | null = null,
): CityLifePlace {
  if (intent === 'VISIT_FRIEND' && target) return target.location;
  if (scheduledPlace) return scheduledPlace;
  if (intent === 'COMMUTE') return workplace;
  if (intent === 'WORK' || intent === 'EAT_OUT' || intent === 'SHOP') return workplace;
  if (intent === 'PUB' || intent === 'LEISURE' || intent === 'VISIT_FRIEND') return 'KIEZ';
  return 'HOME';
}

