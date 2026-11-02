/** Narrative-Domaene: Startzustand, Start-Pool beim neuen Spiel und sichere Normalisierung. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { Visitor, WorldState } from '../types';
import { emitFact } from './facts';
import {
  NARRATIVE_FACT_KINDS, NARRATIVE_LIMITS, VISITOR_VALENCES,
  type NarrativeFact, type NarrativeState, type VisitorMemory, type VisitorValence,
} from './types';

/** Der Start-Pool: drei wiederkehrende Figuren, die ab Tick 0 im Casino bekannt sind. */
const START_ROSTER: ReadonlyArray<{ readonly name: string; readonly persona: Visitor['persona'] }> = [
  { name: 'Rita Kern', persona: 'STAMMGAST' },
  { name: 'Boris Falk', persona: 'BUSINESS' },
  { name: 'Mira Sol', persona: 'STREET' },
];

export function createNarrativeState(): NarrativeState {
  return { factSeq: 1, pending: [], recent: [], processedId: 0, dropped: 0, flags: {} };
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
  if (isRecord(raw.flags)) {
    for (const [key, value] of Object.entries(raw.flags)) {
      if (Number.isFinite(value)) state.flags[key] = Number(value);
    }
  }
  return state;
}

export function normalizeMemories(raw: unknown): VisitorMemory[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeMemory).filter((entry): entry is VisitorMemory => entry !== null)
    .slice(-NARRATIVE_LIMITS.memories);
}

const safeInteger = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value < Number.MAX_SAFE_INTEGER;

function orderedFacts(raw: unknown): NarrativeFact[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<number, NarrativeFact>();
  for (const fact of raw) {
    if (isFact(fact) && !byId.has(fact.id)) byId.set(fact.id, fact);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function isFact(raw: unknown): raw is NarrativeFact {
  if (!isRecord(raw)) return false;
  const kind = raw.kind as NarrativeFact['kind'];
  if (!safeInteger(raw.id, 1) || !NARRATIVE_FACT_KINDS.includes(kind)) return false;
  if (!safeInteger(raw.tick, 0) || !safeInteger(raw.day, 0) || !safeInteger(raw.visitorId, 1)) return false;
  if (kind === 'START_POOL') return safeInteger(raw.capital, 0);
  if (kind === 'VISITOR_FIRST_SEEN') {
    return typeof raw.persona === 'string' && ['LUMPEN', 'STREET', 'BUSINESS', 'HIGH_ROLLER', 'STAMMGAST'].includes(raw.persona);
  }
  if (kind === 'VISITOR_RETURNED') return safeInteger(raw.visits, 1);
  return safeInteger(raw.guestId, 1) && VISITOR_VALENCES.includes(raw.valence as VisitorValence)
    && typeof raw.score === 'number' && Number.isFinite(raw.score) && raw.score >= 0 && raw.score <= 100;
}
