/** Duenne Ablaufkoordination: Fact drainieren, Trigger auswerten, Kandidaten begrenzt planen. */
import type { Ledger } from '../../economy/ledger';
import { recordJournal } from '../journal';
import type { DemandEventKind, WorldState } from '../types';
import { processNarrativeBoundaryDetailed } from './boundary';
import { demandDefinition, isDemandEventId } from './events/demand-definitions';
import { EVENT_TEMPLATES, templateFor } from './events/definitions';
import { createEventCandidate } from './events/template-candidate';
import { EVENT_TRIGGER_DEFINITIONS } from './events/trigger-definitions';
import { scheduleCandidates } from './event-scheduler';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { buildTriggerContext } from './trigger-context';
import { evaluateTriggerDefinition } from './trigger-evaluate';
import type { TriggerMatch } from './trigger-types';
import type { NarrativeFact } from './types';

export interface NarrativeRuntimeResult {
  /** Anzahl der in diesem Lauf drainierten Facts. */
  readonly processed: number;
  /** Davon mit einer Besucher-Erinnerung angewendet. */
  readonly applied: number;
  /** In diesem Lauf neu angelegte Event-Instanzen, hoechstens drei. */
  readonly scheduled: readonly NarrativeEventInstance[];
  /** In diesem Lauf abgelaufene Instanzen. */
  readonly expired: readonly NarrativeEventInstance[];
}

/**
 * Meldet das Ende einer Nachfrageveranstaltung genau einmal pro Lauf. Der
 * Boundary raeumt die Fristen, die Runtime ist die einzige Stelle mit Journal
 * und `lastEvent`; so gibt es keinen zweiten Expiry-Pfad mit eigener Meldung.
 */
function reportExpiredDemand(world: WorldState, expired: readonly NarrativeEventInstance[]): void {
  let ended: DemandEventKind | null = null;
  for (const event of expired) {
    if (isDemandEventId(event.eventId)) ended = event.eventId;
  }
  if (ended === null) return;
  const label = demandDefinition(ended).label;
  world.lastEvent = `${label} ist vorbei. Der Andrang normalisiert sich.`;
  recordJournal(world, {
    kind: 'SYSTEM', subject: label, cause: 'Veranstaltung beendet', effect: world.lastEvent,
  });
}

/**
 * Ein Lauf ist die einzige Bruecke von Facts zu Events. Er verarbeitet nur die
 * bereits drainierten Facts, plant hoechstens drei neue Instanzen und rekursiert
 * nie in neu erzeugte Facts; der naechste Tick/Command-Flush sieht sie.
 */
/**
 * Loest eine EVENT_RESOLVED-Kette zentral und fail-closed auf: Vorgaenger,
 * Template und Choice muessen bekannt sein, sonst entsteht kein Kandidat.
 * Der Lauf verarbeitet nur den bereits drainierten Fact - keine Rekursion.
 */
function followUpCandidate(world: WorldState, fact: NarrativeFact): EventCandidate | null {
  if (fact.kind !== 'EVENT_RESOLVED') return null;
  const prior = world.narrative.events.find((event) => event.id === fact.eventId);
  if (!prior || prior.status !== 'RESOLVED') return null;
  const template = templateFor(prior.templateId, prior.templateVersion) ?? templateFor(prior.templateId);
  if (!template) return null;
  const choice = template.choices.find((entry) => entry.choiceId === fact.choiceId);
  const followUpId = choice?.followUpEventId;
  if (!followUpId) return null;
  const followTemplate = templateFor(followUpId);
  if (!followTemplate) return null;
  const match: TriggerMatch = {
    triggerId: followTemplate.triggerId,
    matched: true,
    factId: fact.id,
    participants: prior.participants,
    reasons: [`chain:${prior.id}->${followUpId}`],
  };
  return createEventCandidate(followTemplate, match, prior.id);
}

export function processNarrativeRuntime(world: WorldState, ledger: Ledger): NarrativeRuntimeResult {
  const boundary = processNarrativeBoundaryDetailed(world, ledger);
  reportExpiredDemand(world, boundary.expired);
  if (boundary.facts.length === 0) {
    return { processed: 0, applied: 0, scheduled: [], expired: boundary.expired };
  }

  const candidates: EventCandidate[] = [];
  for (const fact of boundary.facts) {
    const context = buildTriggerContext(world, ledger, fact);
    for (const definition of EVENT_TRIGGER_DEFINITIONS) {
      const match = evaluateTriggerDefinition(definition, context);
      if (!match.matched) continue;
      for (const template of EVENT_TEMPLATES) {
        if (template.triggerId !== definition.id) continue;
        const candidate = createEventCandidate(template, match);
        if (candidate) candidates.push(candidate);
      }
    }
    const followUp = followUpCandidate(world, fact);
    if (followUp) candidates.push(followUp);
  }
  const scheduled = scheduleCandidates(world, candidates, world.tick);
  return {
    processed: boundary.facts.length,
    applied: boundary.applied,
    scheduled,
    expired: boundary.expired,
  };
}
