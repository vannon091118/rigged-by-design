/**
 * @test-target: src/core/sim/narrative/relationships.ts
 * @error-code: ERR-2001
 *
 * Beziehungen sind gerichtet, haben genau einen Besitzer und pinnen ihre Endpunkte
 * gegen die stumpfe Visitor-Retention.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { processNarrativeBoundary } from '../narrative/boundary';
import { emitFact } from '../narrative/facts';
import {
  actorRefOfVisitor, pinnedVisitorIds, relationshipBetween,
} from '../narrative/relationships';
import { normalizeNarrativeState } from '../narrative/state';
import { createWorld } from '../templates';
import { recordVisitor, VISITOR_CAP } from '../visitors';

const visit = (world: ReturnType<typeof createWorld>, visitorId: number, score: number, valence: 'GOOD' | 'BAD' | 'NEUTRAL'): void => {
  emitFact(world, { kind: 'VISIT_ENDED', visitorId, guestId: visitorId, score, valence });
};

describe('Narrative Beziehungen', () => {
  it('legt aus einem guten Besuch genau eine gerichtete Kante zum Haus an', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const visitor = recordVisitor(world, { name: 'Rita Probe', persona: 'STAMMGAST', tick: 0 });
    visit(world, visitor.id, 90, 'GOOD');
    processNarrativeBoundary(world, ledger);
    const edge = relationshipBetween(world, actorRefOfVisitor(visitor.id), 'player');
    expect(edge?.trust).toBe(2);
    expect(edge?.sympathy).toBe(2);
    expect(relationshipBetween(world, 'player', actorRefOfVisitor(visitor.id))).toBeNull();
  });

  it('summiert gute und schlechte Besuche auf derselben Kante und begrenzt sie', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const visitor = recordVisitor(world, { name: 'Boris Probe', persona: 'BUSINESS', tick: 0 });
    visit(world, visitor.id, 90, 'GOOD');
    processNarrativeBoundary(world, ledger);
    visit(world, visitor.id, 10, 'BAD');
    processNarrativeBoundary(world, ledger);
    const edge = relationshipBetween(world, actorRefOfVisitor(visitor.id), 'player');
    expect(edge?.trust).toBe(-1);
    expect(edge?.sympathy).toBe(0);
  });

  it('erzeugt fuer einen neutralen Besuch keine Kante und pinnt niemanden', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const visitor = recordVisitor(world, { name: 'Mira Probe', persona: 'STREET', tick: 0 });
    visit(world, visitor.id, 50, 'NEUTRAL');
    processNarrativeBoundary(world, ledger);
    expect(world.narrative.relationships).toEqual([]);
    expect(pinnedVisitorIds(world).size).toBe(0);
  });

  it('schuetzt gepinnte Besucher vor der Retention und laesst ungepinnte altern', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const pinned: number[] = [];
    for (let index = 0; index < VISITOR_CAP; index += 1) {
      const visitor = recordVisitor(world, { name: `Gast ${index}`, persona: 'STAMMGAST', tick: index });
      pinned.push(visitor.id);
      visit(world, visitor.id, 90, 'GOOD');
    }
    processNarrativeBoundary(world, ledger);
    const newcomer = recordVisitor(world, { name: 'Neu', persona: 'STREET', tick: VISITOR_CAP });
    expect(world.visitors).toHaveLength(VISITOR_CAP + 1);
    expect(world.visitors.some((visitor) => visitor.id === pinned[0])).toBe(true);
    expect(world.visitors.some((visitor) => visitor.id === newcomer.id)).toBe(true);
    expect(pinnedVisitorIds(world).size).toBe(VISITOR_CAP);
    expect(relationshipBetween(world, actorRefOfVisitor(pinned[0]!), 'player')).not.toBeNull();
  });

  it('verdraengt ohne Beziehung weiterhin den aeltesten Besucher', () => {
    const world = createWorld('SMALL');
    for (let index = 0; index < VISITOR_CAP; index += 1) {
      recordVisitor(world, { name: `Gast ${index}`, persona: 'STREET', tick: index });
    }
    recordVisitor(world, { name: 'Neu', persona: 'STREET', tick: VISITOR_CAP });
    expect(world.visitors).toHaveLength(VISITOR_CAP);
    expect(world.visitors.some((visitor) => visitor.id === 1)).toBe(false);
  });

  it('normalisiert Kanten, verwirft Selbstbezug und begrenzt die Dimensionen', () => {
    const state = normalizeNarrativeState({
      factSeq: 1, processedId: 0, relationships: [
        { from: 'visitor:1', to: 'player', trust: 99, sympathy: -99, conflict: 1, influence: 2, updatedTick: 5 },
        { from: 'visitor:2', to: 'visitor:2', trust: 1, sympathy: 1, conflict: 0, influence: 0, updatedTick: 6 },
        { from: 'kaputt', to: 'player', trust: 1, sympathy: 1, conflict: 0, influence: 0, updatedTick: 7 },
      ],
    });
    expect(state.relationships).toHaveLength(1);
    expect(state.relationships[0]).toEqual({
      from: 'visitor:1', to: 'player', trust: 10, sympathy: -10, conflict: 1, influence: 2, updatedTick: 5,
    });
  });

  it('uebersteht einen JSON-Roundtrip mit Kanten und Cursor', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const visitor = recordVisitor(world, { name: 'Rita Kern', persona: 'STAMMGAST', tick: 0 });
    visit(world, visitor.id, 90, 'GOOD');
    processNarrativeBoundary(world, ledger);
    const restored = normalizeNarrativeState(JSON.parse(JSON.stringify(world.narrative)));
    expect(restored.relationships).toEqual(world.narrative.relationships);
    expect(restored.ledgerSeq).toBe(world.narrative.ledgerSeq);
    expect(restored.houseBand).toBe(world.narrative.houseBand);
  });

  it('uebersteht einen JSON-Roundtrip mit gemischten Beziehungsquellen', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const first = recordVisitor(world, { name: 'Rita Quelle', persona: 'STAMMGAST', tick: 0 });
    const second = recordVisitor(world, { name: 'Boris Quelle', persona: 'BUSINESS', tick: 0 });
    const third = recordVisitor(world, { name: 'Mira Quelle', persona: 'STREET', tick: 0 });
    emitFact(world, {
      kind: 'VISITOR_SERVICE', actorRefs: [actorRefOfVisitor(first.id), 'staff:1'], service: 'CASHIER', valence: 'GOOD',
    });
    emitFact(world, {
      kind: 'VISITOR_CONFLICT', actorRefs: [actorRefOfVisitor(second.id), actorRefOfVisitor(third.id)],
      initiator: actorRefOfVisitor(second.id), severity: 1,
    });
    emitFact(world, {
      kind: 'RIVAL_ENCOUNTER', actorRefs: ['rival:HAFENKLAUSE', 'player'], rivalId: 'HAFENKLAUSE', netToHouse: 500,
    });
    processNarrativeBoundary(world, ledger);
    const restored = normalizeNarrativeState(JSON.parse(JSON.stringify(world.narrative)));
    expect(restored.relationships).toEqual(world.narrative.relationships);
    expect(restored.recent).toEqual(world.narrative.recent);
    expect(restored.relationships).toHaveLength(4);
  });

  it('dedupliziert Kanten mit derselben Richtung beim Laden', () => {
    const edge = { from: 'visitor:1', to: 'staff:2', trust: 1, sympathy: 2, conflict: 3, influence: 4, updatedTick: 5 };
    const state = normalizeNarrativeState({
      relationships: [edge, { ...edge, trust: 9 }],
    });
    expect(state.relationships).toEqual([edge]);
  });

  it('akzeptiert Hauskonto-Facts ohne Besucherbezug neben Beziehungs-Facts', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(150), 'start', 0);
    processNarrativeBoundary(world, ledger);
    ledger.transfer('HAUSKONTO', 'UTILITIES', fromVC(120), 'miete', 1);
    processNarrativeBoundary(world, ledger);
    expect(world.narrative.recent.some((fact) => fact.kind === 'HOUSE_BALANCE')).toBe(true);
    expect(world.narrative.relationships).toEqual([]);
  });
});
