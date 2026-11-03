/** Duenne Ablaufkoordination: Fact drainieren, Trigger auswerten, Kandidaten begrenzt planen. */
import type { Ledger } from '../../economy/ledger';
import type { WorldState } from '../types';
import { processNarrativeBoundaryDetailed } from './boundary';
import { EVENT_TEMPLATES } from './events/definitions';
import { createEventCandidate } from './events/template-candidate';
import { EVENT_TRIGGER_DEFINITIONS } from './events/trigger-definitions';
import { scheduleCandidates } from './event-scheduler';
import type { EventCandidate, NarrativeEventInstance } from './event-types';
import { buildTriggerContext } from './trigger-context';
import { evaluateTriggerDefinition } from './trigger-evaluate';

export interface NarrativeRuntimeResult {
  /** Anzahl der in diesem Lauf drainierten Facts. */
  readonly processed: number;
  /** Davon mit einer Besucher-Erinnerung angewendet. */
  readonly applied: number;
  /** In diesem Lauf neu angelegte Event-Instanzen, hoechstens drei. */
  readonly scheduled: readonly NarrativeEventInstance[];
}

/**
 * Ein Lauf ist die einzige Bruecke von Facts zu Events. Er verarbeitet nur die
 * bereits drainierten Facts, plant hoechstens drei neue Instanzen und rekursiert
 * nie in neu erzeugte Facts; der naechste Tick/Command-Flush sieht sie.
 */
export function processNarrativeRuntime(world: WorldState, ledger: Ledger): NarrativeRuntimeResult {
  const boundary = processNarrativeBoundaryDetailed(world, ledger);
  if (boundary.facts.length === 0) return { processed: 0, applied: 0, scheduled: [] };

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
  }
  const scheduled = scheduleCandidates(world, candidates, world.tick);
  return { processed: boundary.facts.length, applied: boundary.applied, scheduled };
}
