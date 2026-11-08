/**
 * Ein Streit zwischen zwei Gaesten laeuft nach der Eskalation in zwei
 * unabhaengige Echos auseinander: jeder Beteiligte traegt seine eigene spaetere
 * Begegnung. Wird der Streit entschaerft, endet die Kette ohne Folgeknoten.
 */
import type { NarrativeChain } from '../chain-types';

export const PAIR_CONFLICT_ARC: NarrativeChain = {
  chainId: 'PAIR_CONFLICT_ARC',
  version: 1,
  start: 'CONFLICT',
  nodes: [
    { nodeId: 'CONFLICT', eventId: 'VISITOR_CONFLICT' },
    {
      nodeId: 'ECHO_FIRST',
      eventId: 'CHAIN_VISITOR_ECHO',
      participantMode: 'first',
      terminal: true,
    },
    {
      nodeId: 'ECHO_LAST',
      eventId: 'CHAIN_VISITOR_ECHO',
      participantMode: 'last',
      terminal: true,
    },
  ],
  edges: [
    {
      edgeId: 'ESCALATED_FIRST_ECHO',
      from: 'CONFLICT',
      to: 'ECHO_FIRST',
      priority: 20,
      delayTicks: 8,
      parallel: true,
      when: {
        op: 'event-resolved', eventId: 'VISITOR_CONFLICT', outcomeId: 'ESCALATED',
      },
    },
    {
      edgeId: 'ESCALATED_LAST_ECHO',
      from: 'CONFLICT',
      to: 'ECHO_LAST',
      priority: 20,
      delayTicks: 8,
      parallel: true,
      when: {
        op: 'event-resolved', eventId: 'VISITOR_CONFLICT', outcomeId: 'ESCALATED',
      },
    },
  ],
  maxSteps: 2,
  maxDurationTicks: 120,
  repeatable: false,
  cooldownTicks: 0,
};
