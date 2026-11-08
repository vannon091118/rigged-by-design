/**
 * Zwei echte Pfade aus derselben warmen Rueckkehr: Die Influence-Matrix
 * entscheidet, ob das direkte Nachspiel oder ein spaeteres Echo folgt. Beide
 * Enden sind mechanisch verschieden und teilen sich denselben Echo-Knoten.
 */
import type { NarrativeChain } from '../chain-types';

export const VISITOR_WARM_ARC: NarrativeChain = {
  chainId: 'VISITOR_WARM_ARC',
  version: 1,
  start: 'WARM_OPENING',
  nodes: [
    { nodeId: 'WARM_OPENING', eventId: 'VISITOR_RETURN_WARM' },
    { nodeId: 'AFTERMATH', eventId: 'VISITOR_AFTERMATH' },
    {
      nodeId: 'ECHO',
      eventId: 'CHAIN_VISITOR_ECHO',
      terminal: true,
      abort: {
        op: 'relationship-between', from: { participant: 0 }, to: 'player',
        dimension: 'conflict', min: 3,
      },
    },
  ],
  edges: [
    {
      edgeId: 'WARM_TO_AFTERMATH',
      from: 'WARM_OPENING',
      to: 'AFTERMATH',
      priority: 20,
      when: { op: 'influence-between', context: 'event-warm', min: 0.45 },
    },
    {
      edgeId: 'WARM_TO_ECHO',
      from: 'WARM_OPENING',
      to: 'ECHO',
      priority: 10,
      delayTicks: 6,
      when: { op: 'not', condition: { op: 'influence-between', context: 'event-warm', min: 0.45 } },
    },
    {
      edgeId: 'AFTERMATH_TO_ECHO',
      from: 'AFTERMATH',
      to: 'ECHO',
      priority: 10,
      delayTicks: 12,
      when: {
        op: 'relationship-between', from: { participant: 0 }, to: 'player',
        dimension: 'trust', min: 2,
      },
    },
  ],
  maxSteps: 4,
  maxDurationTicks: 200,
  repeatable: false,
  cooldownTicks: 0,
};
