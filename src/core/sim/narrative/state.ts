/** Narrative-Domaene: Startzustand, Start-Pool beim neuen Spiel und sichere Normalisierung. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { Visitor, WorldState } from '../types';
import { emitFact } from './facts';
import { orderedFacts, safeInteger } from './fact-schema';
import { normalizeRelationships } from './relationships';
import { normalizeEventState } from './event-schema';
import { createNarrativeRng } from './narrative-rng';
import {
  HOUSE_BANDS, NARRATIVE_LIMITS, VISITOR_VALENCES,
  type HouseBand, type NarrativeState, type VisitorMemory, type VisitorValence,
} from './types';

/** Der Start-Pool: drei wiederkehrende Figuren, die ab Tick 0 im Casino bekannt sind. */
const START_ROSTER: ReadonlyArray<{ readonly name: string; readonly persona: Visitor['persona'] }> = [
  { name: 'Rita Kern', persona: 'STAMMGAST' },
  { name: 'Boris Falk', persona: 'BUSINESS' },
  { name: 'Mira Sol', persona: 'STREET' },
];

export function createNarrativeState(): NarrativeState {
  return {
    factSeq: 1, pending: [], recent: [], processedId: 0, dropped: 0,
    demandEvent: null, flags: {}, relationships: [], ledgerSeq: null, houseBand: 'OK',
    eventSeq: 1, events: [], cooldowns: [], rng: createNarrativeRng(),
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
  if (isRecord(raw.demandEvent) && (raw.demandEvent.kind === 'NEON_NACHT' || raw.demandEvent.kind === 'TURNIER_ABEND')
    && safeInteger(raw.demandEvent.untilTick, 0)) {
    state.demandEvent = { kind: raw.demandEvent.kind, untilTick: raw.demandEvent.untilTick };
  }
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
  return state;
}

export function normalizeMemories(raw: unknown): VisitorMemory[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeMemory).filter((entry): entry is VisitorMemory => entry !== null)
    .slice(-NARRATIVE_LIMITS.memories);
}
