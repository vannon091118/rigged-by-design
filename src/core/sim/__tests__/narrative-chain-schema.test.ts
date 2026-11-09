/**
 * @test-target: src/core/sim/narrative/chains/chain-schema.ts
 * @error-code: ERR-2001
 *
 * Ereignisketten sind nur spielbar, wenn Start, Erreichbarkeit, Endknoten und
 * Zyklen statisch geklaert sind. Jede Verletzung wird fail-closed abgelehnt;
 * eine erlaubte Wiederaufnahme bleibt ausdruecklich moeglich.
 */
import { describe, expect, it } from 'vitest';
import { mergeNodeIds, reachableNodes } from '../narrative/chains/chain-graph';
import { isNarrativeChain } from '../narrative/chains/chain-schema';
import type { ChainCondition, NarrativeChain } from '../narrative/chains/chain-types';
import { NARRATIVE_CHAINS } from '../narrative/chains/definitions';
import { PAIR_CONFLICT_ARC } from '../narrative/chains/definitions/pair-conflict-arc';
import { VISITOR_WARM_ARC } from '../narrative/chains/definitions/visitor-warm-arc';
import { templateFor } from '../narrative/events/definitions';

const cycleProbe = (repeatable: boolean): NarrativeChain => ({
  chainId: 'CYCLE_PROBE',
  version: 1,
  start: 'A',
  nodes: [
    { nodeId: 'A', eventId: 'VISITOR_AFTERMATH' },
    { nodeId: 'B', eventId: 'VISITOR_AFTERMATH' },
  ],
  edges: [
    { edgeId: 'A_TO_B', from: 'A', to: 'B', repeatable },
    { edgeId: 'B_TO_A', from: 'B', to: 'A', repeatable },
  ],
  maxSteps: 4,
  maxDurationTicks: 100,
  repeatable: false,
  cooldownTicks: 0,
});

const pairProbe = (mode: 'inherit' | 'first'): NarrativeChain => ({
  chainId: 'PAIR_PROBE',
  version: 1,
  start: 'CONFLICT',
  nodes: [
    { nodeId: 'CONFLICT', eventId: 'VISITOR_CONFLICT' },
    { nodeId: 'ECHO', eventId: 'CHAIN_VISITOR_ECHO', participantMode: mode, terminal: true },
  ],
  edges: [{
    edgeId: 'ESCALATED', from: 'CONFLICT', to: 'ECHO',
    when: { op: 'event-resolved', eventId: 'VISITOR_CONFLICT', outcomeId: 'ESCALATED' },
  }],
  maxSteps: 2,
  maxDurationTicks: 100,
  repeatable: false,
  cooldownTicks: 0,
});

describe('Ereignisketten-Schema', () => {
  it('akzeptiert beide registrierten Ketten und jeden Knoten mit Template', () => {
    for (const chain of NARRATIVE_CHAINS) {
      expect(isNarrativeChain(chain)).toBe(true);
      for (const node of chain.nodes) expect(templateFor(node.eventId)).not.toBeNull();
    }
    expect(NARRATIVE_CHAINS.map((chain) => chain.chainId))
      .toEqual(['VISITOR_WARM_ARC', 'PAIR_CONFLICT_ARC', 'CITY_ENCOUNTER_ARC']);
    expect(mergeNodeIds(VISITOR_WARM_ARC)).toEqual(['ECHO']);
    expect(reachableNodes(PAIR_CONFLICT_ARC).size).toBe(PAIR_CONFLICT_ARC.nodes.length);
  });

  it('lehnt einen unbekannten Start und nicht erreichbare Knoten ab', () => {
    expect(isNarrativeChain({ ...VISITOR_WARM_ARC, start: 'NOPE' })).toBe(false);
    const orphan: NarrativeChain = {
      ...VISITOR_WARM_ARC,
      nodes: [...VISITOR_WARM_ARC.nodes, { nodeId: 'ORPHAN', eventId: 'CHAIN_VISITOR_ECHO', terminal: true }],
    };
    expect(isNarrativeChain(orphan)).toBe(false);
  });

  it('lehnt eine Kante auf einen unbekannten Knoten ab', () => {
    const dangling: NarrativeChain = {
      ...VISITOR_WARM_ARC,
      edges: [
        ...VISITOR_WARM_ARC.edges,
        { edgeId: 'BROKEN', from: 'AFTERMATH', to: 'NOPE' },
      ],
    };
    expect(isNarrativeChain(dangling)).toBe(false);
  });

  it('verlangt fuer jeden Nicht-Endknoten eine Folge', () => {
    const deadEnd: NarrativeChain = {
      ...VISITOR_WARM_ARC,
      edges: VISITOR_WARM_ARC.edges.filter((edge) => edge.from !== 'WARM_OPENING'),
    };
    expect(isNarrativeChain(deadEnd)).toBe(false);
  });

  it('erlaubt einen Zyklus nur mit ausdruecklicher Wiederaufnahme', () => {
    expect(isNarrativeChain(cycleProbe(false))).toBe(false);
    expect(isNarrativeChain(cycleProbe(true))).toBe(true);
  });

  it('weist ungueltige Wertebereiche und leere Verknuepfungen ab', () => {
    const invalidRange: ChainCondition = { op: 'flag-between', flag: 'mut', min: 5, max: 1 };
    const invalid: NarrativeChain = {
      ...VISITOR_WARM_ARC,
      edges: VISITOR_WARM_ARC.edges.map((edge, index) => index === 0 ? { ...edge, when: invalidRange } : edge),
    };
    expect(isNarrativeChain(invalid)).toBe(false);
    const emptyAll: ChainCondition = { op: 'all', conditions: [] };
    expect(isNarrativeChain({
      ...VISITOR_WARM_ARC,
      edges: VISITOR_WARM_ARC.edges.map((edge, index) => index === 0 ? { ...edge, when: emptyAll } : edge),
    })).toBe(false);
  });

  it('prueft die Teilnehmerzahl beim Wechsel: Paar zu Einzel nur per first/last', () => {
    expect(isNarrativeChain(pairProbe('inherit'))).toBe(false);
    expect(isNarrativeChain(pairProbe('first'))).toBe(true);
  });
});
