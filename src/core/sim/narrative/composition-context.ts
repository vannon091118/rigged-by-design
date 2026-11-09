/** B1: Reine Ableitung des Composer-Kontexts aus Welt, Fact, Event und Template. */
import type { Ledger } from '../../economy/ledger';
import type { Visitor, WorldState } from '../types';
import type { NarrativeEventInstance } from './event-types';
import type { ChoiceRequirement, EventTemplate } from './events/template-types';
import { visitorIdOf } from './relationships';
import type { NarrativeFact, RelationshipEdge } from './types';

/** Nur die Composer-Felder; die Szene selbst bleibt in `view.ts`. */
interface CompositionContext {
  readonly contexts: readonly string[];
  readonly availablePersonas: readonly string[];
  readonly relationship: string;
  readonly mood: string;
  readonly requiredFlags: readonly string[];
}

/** Persona-Refs der Registry sind Namens-Slugs, keine Persona-IDs. */
const slug = (name: string): string => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const TRIGGER_CONTEXTS: Readonly<Record<string, string>> = {
  'visitor-returned': 'return', 'visitor-conflict': 'conflict', 'rival-action': 'rival', ENGINE_DEMAND: 'demand',
};
const EVENT_CONTEXTS: Readonly<Record<string, string>> = {
  VISITOR_RETURN: 'return', VISITOR_CONFLICT: 'conflict', RIVAL_MOVE: 'rival',
  NEON_NACHT: 'demand', TURNIER_ABEND: 'demand',
};
const FACT_CONTEXTS: Partial<Record<NarrativeFact['kind'], string>> = {
  VISITOR_RETURNED: 'return', VISITOR_CONFLICT: 'conflict', VISITOR_SERVICE: 'service',
  SLOT_DISCHARGE: 'discharge', RIVAL_ACTION: 'rival', RIVAL_ENCOUNTER: 'rival',
};
const FACT_MOODS: Partial<Record<NarrativeFact['kind'], string>> = {
  VISITOR_RETURNED: 'neugierig', VISITOR_CONFLICT: 'angespannt', COMMAND_REJECTED: 'argwoehnisch',
  EVENT_RESOLVED: 'entschlossen', START_POOL: 'entschlossen', SLOT_DISCHARGE: 'neugierig',
};
const MAX_FLAGS = 12;
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

function templateContexts(template: EventTemplate): string[] {
  return unique([TRIGGER_CONTEXTS[template.triggerId], EVENT_CONTEXTS[template.eventId]]
    .filter((value): value is string => value !== undefined));
}

function factContexts(fact: NarrativeFact): readonly string[] {
  if (fact.kind === 'VISIT_ENDED') return fact.valence === 'BAD' ? ['loss'] : ['return'];
  const context = FACT_CONTEXTS[fact.kind];
  return context ? [context] : [];
}

function sourceFactOf(world: WorldState, event: NarrativeEventInstance): NarrativeFact | null {
  return event.sourceFactId <= 0 ? null : world.narrative.recent.find((fact) => fact.id === event.sourceFactId) ?? null;
}

function availablePersonasOf(world: WorldState, event: NarrativeEventInstance): string[] {
  const ids = unique(event.participants.map(visitorIdOf).filter((id): id is number => id !== null));
  return unique(ids.flatMap((id) => {
    const persona = slug(world.visitors.find((visitor) => visitor.id === id)?.name ?? '');
    return persona ? [persona] : [];
  }));
}

/** Eine gerichtete Kante: bei Paaren zwischen den Besuchern, sonst zum Haus. */
function relationshipEdgeOf(world: WorldState, event: NarrativeEventInstance): RelationshipEdge | null {
  const from = event.participants.find((ref) => visitorIdOf(ref) !== null) ?? event.participants[0];
  if (!from) return null;
  const to = event.participants.find((ref) => ref !== from && visitorIdOf(ref) !== null) ?? 'player';
  return from === to ? null : world.narrative.relationships.find((edge) => edge.from === from && edge.to === to) ?? null;
}

function primaryVisitorOf(world: WorldState, event: NarrativeEventInstance): Visitor | null {
  const id = event.participants.map(visitorIdOf).find((value) => value !== null);
  return id === undefined ? null : world.visitors.find((visitor) => visitor.id === id) ?? null;
}

function factRelationship(fact: NarrativeFact | null): string | null {
  if (!fact) return null;
  if (fact.kind === 'VISITOR_CONFLICT') return 'konflikt';
  if (fact.kind === 'VISIT_ENDED' || fact.kind === 'VISITOR_SERVICE') {
    return fact.valence === 'GOOD' ? 'vertrauen' : fact.valence === 'BAD' ? 'konflikt' : null;
  }
  if (fact.kind === 'RIVAL_ACTION') return fact.action === 'TRADE_INFO' ? 'vertrauen' : fact.action === 'PROBE' ? 'distanz' : 'konflikt';
  if (fact.kind !== 'RIVAL_ENCOUNTER' || fact.netToHouse === 0) return null;
  return fact.netToHouse > 0 ? 'konflikt' : 'vertrauen';
}

function edgeRelationship(edge: RelationshipEdge | null): string | null {
  if (!edge) return null;
  if (edge.conflict >= 2 || edge.trust <= -2 || edge.sympathy <= -2) return 'konflikt';
  return edge.trust >= 2 || edge.sympathy >= 2 ? 'vertrauen' : null;
}

function memoryRelationship(visitor: Visitor | null): string | null {
  const memory = (visitor?.memories ?? []).at(-1);
  return memory?.valence === 'GOOD' ? 'vertrauen' : memory?.valence === 'BAD' ? 'konflikt' : null;
}

function factMood(fact: NarrativeFact | null): string | null {
  if (!fact) return null;
  if (fact.kind === 'VISIT_ENDED' || fact.kind === 'VISITOR_SERVICE') {
    return fact.valence === 'GOOD' ? 'neugierig' : fact.valence === 'BAD' ? 'argwoehnisch' : 'neutral';
  }
  if (fact.kind === 'RIVAL_ACTION') return fact.action === 'SABOTAGE' ? 'argwoehnisch' : fact.action === 'TRADE_INFO' ? 'neugierig' : 'angespannt';
  if (fact.kind === 'RIVAL_ENCOUNTER') return fact.netToHouse > 0 ? 'angespannt' : 'neutral';
  if (fact.kind === 'HOUSE_BALANCE') return fact.band === 'LOW' ? 'argwoehnisch' : 'neutral';
  return FACT_MOODS[fact.kind] ?? null;
}

function edgeMood(edge: RelationshipEdge | null): string | null {
  if (!edge) return null;
  if (edge.conflict >= 2) return 'angespannt';
  return edge.trust >= 2 || edge.sympathy >= 2 ? 'neugierig' : null;
}

function memoryMood(visitor: Visitor | null): string | null {
  const memory = (visitor?.memories ?? []).at(-1);
  if (memory?.valence === 'GOOD') return 'neugierig';
  return memory?.valence === 'BAD' ? 'argwoehnisch' : memory?.valence === 'NEUTRAL' ? 'neutral' : null;
}

function collectFlags(requirements: readonly ChoiceRequirement[], flags: Set<string>): void {
  for (const requirement of requirements) {
    if (requirement.op === 'flag-at-least' || requirement.op === 'flag-present') flags.add(requirement.flag);
    else if (requirement.op === 'all') collectFlags(requirement.requirements, flags);
  }
}

/** Nur Flag-Namen aus dem konkreten Template; Welt-Flags bleiben draussen. */
function requiredFlagsOf(template: EventTemplate): string[] {
  const flags = new Set<string>();
  for (const choice of template.choices) collectFlags(choice.requirements, flags);
  return [...flags].slice(0, MAX_FLAGS);
}

/**
 * Reine Ableitung ohne Mutation. Der Ledger bleibt in der Signatur, weil der
 * View ihn bereits fuer Choices haelt; die Textwahl liest keine Geldwerte.
 */
export function buildCompositionContext(
  world: WorldState, _ledger: Ledger, event: NarrativeEventInstance, template: EventTemplate,
): CompositionContext {
  const fact = sourceFactOf(world, event);
  const edge = relationshipEdgeOf(world, event);
  const visitor = primaryVisitorOf(world, event);
  return {
    contexts: fact ? factContexts(fact) : templateContexts(template),
    availablePersonas: availablePersonasOf(world, event),
    relationship: factRelationship(fact) ?? edgeRelationship(edge) ?? memoryRelationship(visitor) ?? 'neutral',
    mood: factMood(fact) ?? edgeMood(edge) ?? memoryMood(visitor) ?? 'neutral',
    requiredFlags: requiredFlagsOf(template),
  };
}
