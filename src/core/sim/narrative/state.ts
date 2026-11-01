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
  const pending = Array.isArray(raw.pending) ? raw.pending.filter(isFact) : [];
  const recent = Array.isArray(raw.recent) ? raw.recent.filter(isFact) : [];
  state.pending = pending.slice(-NARRATIVE_LIMITS.pending);
  state.recent = recent.slice(-NARRATIVE_LIMITS.recent);
  const maxId = [...state.pending, ...state.recent].reduce((max, fact) => Math.max(max, fact.id), 0);
  state.factSeq = Math.max(1, Math.floor(number(raw.factSeq, 1)), maxId + 1);
  state.processedId = Math.min(Math.max(0, Math.floor(number(raw.processedId))), state.factSeq - 1);
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

function isFact(raw: unknown): raw is NarrativeFact {
  if (!isRecord(raw)) return false;
  const id = number(raw.id, -1);
  const kind = raw.kind as NarrativeFact['kind'];
  if (!Number.isInteger(id) || id <= 0) return false;
  if (!NARRATIVE_FACT_KINDS.includes(kind)) return false;
  if (!Number.isFinite(raw.tick) || !Number.isFinite(raw.day)) return false;
  if (!Number.isInteger(number(raw.visitorId, -1))) return false;
  if (kind === 'VISIT_ENDED') {
    return Number.isInteger(number(raw.guestId, -1))
      && VISITOR_VALENCES.includes(raw.valence as VisitorValence)
      && Number.isFinite(raw.score);
  }
  return true;
}
