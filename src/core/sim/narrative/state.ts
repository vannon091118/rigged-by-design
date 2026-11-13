/** Narrative-Domaene: Startzustand, Start-Pool beim neuen Spiel und sichere Normalisierung. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { Visitor, WorldState } from '../types';
import { emitFact } from './facts';
import { orderedFacts, safeInteger } from './fact-schema';
import { normalizeRelationships } from './relationships';
import { normalizeKnowledge } from './knowledge';
import { normalizeExchanges } from './knowledge-persist';
import { normalizeObservations } from './knowledge-observation';
import { normalizeEventState } from './event-schema';
import { createChainState, normalizeChainState } from './chains/chain-persist';
import { createNarrativeRng } from './narrative-rng';
import {
  HOUSE_BANDS, NARRATIVE_LIMITS, VISITOR_VALENCES,
  type HouseBand, type NarrativeState, type VisitorMemory, type VisitorValence,
} from './types';

/**
 * Der Start-Pool: drei wiederkehrende Figuren, die ab Tick 0 im Casino bekannt
 * sind. Die Kennung steht hier, nicht der Name: Sie verbindet das Profil mit
 * dem Stadtbewohner, auch wenn ein Gast denselben Namen traegt.
 */
const START_ROSTER: ReadonlyArray<{
  readonly npcId: string; readonly name: string; readonly persona: Visitor['persona'];
}> = [
  { npcId: 'rita', name: 'Rita Kern', persona: 'STAMMGAST' },
  { npcId: 'boris', name: 'Boris Falk', persona: 'BUSINESS' },
  { npcId: 'mira', name: 'Mira Sol', persona: 'STREET' },
];

export function createNarrativeState(): NarrativeState {
  return {
    factSeq: 1, pending: [], recent: [], processedId: 0, dropped: 0,
    flags: {}, relationships: [], knowledge: [], knowledgeSeq: 1,
    exchanges: [], exchangeSeq: 1,
    observations: [], observationSeq: 1, ledgerSeq: null, houseBand: 'OK',
    eventSeq: 1, events: [], cooldowns: [], rng: createNarrativeRng(),
    chains: createChainState(),
  };
}

/** Legt den Start-Pool an und bucht das Startkapital als narrativen Fact. Idempotent. */
export function seedStartPool(world: WorldState, capital: VaCoinMicro): void {
  const state = world.narrative;
  if (state.flags.startkapital !== undefined) return;
  state.flags.startkapital = capital;
  state.flags.startpool = 0;
  for (const entry of START_ROSTER.slice(0, NARRATIVE_LIMITS.startPool)) {
    const visitor: Visitor = {
      id: world.nextVisitorId, name: entry.name, persona: entry.persona,
      residentNpcId: entry.npcId,
      visits: 1, lastSeenTick: 0, memories: [],
    };
    world.nextVisitorId += 1;
    world.visitors.push(visitor);
    emitFact(world, { kind: 'START_POOL', visitorId: visitor.id, capital });
    state.flags.startpool += 1;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const number = (value: unknown, fallback = 0): number => (Number.isFinite(value) ? Number(value) : fallback);

function sanitizeMemory(raw: unknown): VisitorMemory | null {
  if (!isRecord(raw)) return null;
  const valence = raw.valence as VisitorValence;
  if (!VISITOR_VALENCES.includes(valence)) return null;
  const factId = number(raw.factId, -1);
  if (!Number.isInteger(factId) || factId <= 0) return null;
  return { factId, tick: Math.max(0, Math.floor(number(raw.tick))), score: Math.min(100, Math.max(0, number(raw.score))), valence };
}

/** Ergaenzt sichere Defaults, verwirft kaputte Eintraege und haelt alle Grenzen ein. */
export function normalizeNarrativeState(raw: unknown): NarrativeState {
  const state = createNarrativeState();
  if (!isRecord(raw)) return state;
  const pending = orderedFacts(raw.pending);
  const recent = orderedFacts(raw.recent);
  const maxId = [...pending, ...recent].reduce((max, fact) => Math.max(max, fact.id), 0);
  const nextId = safeInteger(raw.factSeq, 1) ? raw.factSeq : 1;
  const processedId = safeInteger(raw.processedId, 0) ? raw.processedId : 0;
  state.factSeq = Math.max(nextId, maxId + 1, processedId + 1);
  state.processedId = processedId;
  state.pending = pending.filter((fact) => fact.id > processedId).slice(-NARRATIVE_LIMITS.pending);
  state.recent = recent.filter((fact) => fact.id <= processedId).slice(-NARRATIVE_LIMITS.recent);
  state.dropped = Math.max(0, Math.floor(number(raw.dropped)));
  state.ledgerSeq = safeInteger(raw.ledgerSeq, -1) ? raw.ledgerSeq : null;
  state.houseBand = HOUSE_BANDS.includes(raw.houseBand as HouseBand) ? raw.houseBand as HouseBand : 'OK';
  state.relationships = normalizeRelationships(raw.relationships);
  state.knowledge = normalizeKnowledge(raw.knowledge);
  const maxKnowledge = state.knowledge.reduce((max, entry) => Math.max(max, entry.id), 0);
  state.knowledgeSeq = Math.max(state.knowledgeSeq, maxKnowledge + 1);
  state.exchanges = normalizeExchanges(raw.exchanges);
  const maxExchange = state.exchanges.reduce((max, entry) => Math.max(max, entry.id), 0);
  state.exchangeSeq = Math.max(state.exchangeSeq, maxExchange + 1);
  state.observations = normalizeObservations(raw.observations);
  const maxObservation = state.observations.reduce((max, entry) => Math.max(max, entry.id), 0);
  state.observationSeq = Math.max(state.observationSeq, maxObservation + 1);
  if (isRecord(raw.flags)) {
    for (const [key, value] of Object.entries(raw.flags)) {
      if (Number.isFinite(value)) state.flags[key] = Number(value);
    }
  }
  const events = normalizeEventState(raw);
  state.eventSeq = events.eventSeq;
  state.events = events.events;
  state.cooldowns = events.cooldowns;
  state.rng = events.rng;
  state.chains = normalizeChainState(raw.chains);
  return state;
}

export function normalizeMemories(raw: unknown): VisitorMemory[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeMemory).filter((entry): entry is VisitorMemory => entry !== null)
    .slice(-NARRATIVE_LIMITS.memories);
}
