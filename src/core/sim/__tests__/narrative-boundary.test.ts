/**
 * @test-target: src/core/sim/narrative/boundary.ts
 * @error-code: ERR-2001
 *
 * Der Boundary ist der einzige Verbraucher der Fact-Queue: Ledger-Schwellen werden
 * genau einmal gemeldet, Besucher-Facts im selben Durchlauf verarbeitet.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO, openHouse, UTILITIES } from '../money';
import { processNarrativeBoundary } from '../narrative/boundary';
import { emitFact, recentFacts } from '../narrative/facts';
import { normalizeNarrativeState } from '../narrative/state';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';

const setup = () => ({ world: createWorld('SMALL'), ledger: new Ledger() });

describe('Narrative Boundary', () => {
  it('setzt beim ersten Lauf einen Cursor, ohne alte Schwellen nachzuholen', () => {
    const { world, ledger } = setup();
    openHouse(ledger, 0);
    ledger.transfer(HAUSKONTO, UTILITIES, fromVC(120), 'miete', 1);
    expect(processNarrativeBoundary(world, ledger)).toBe(0);
    expect(recentFacts(world, 'HOUSE_BALANCE')).toHaveLength(0);
    expect(world.narrative.ledgerSeq).toBe(1);
    expect(world.narrative.houseBand).toBe('LOW');
  });

  it('meldet einen Schwellenuebergang genau einmal und den Rueckweg als zweiten Fact', () => {
    const { world, ledger } = setup();
    openHouse(ledger, 0);
    processNarrativeBoundary(world, ledger);
    ledger.transfer(HAUSKONTO, UTILITIES, fromVC(120), 'miete', 1);
    processNarrativeBoundary(world, ledger);
    const low = recentFacts(world, 'HOUSE_BALANCE');
    expect(low).toHaveLength(1);
    expect(low[0]!.kind === 'HOUSE_BALANCE' ? low[0]!.balance : 0).toBe(fromVC(30));
    processNarrativeBoundary(world, ledger);
    expect(recentFacts(world, 'HOUSE_BALANCE')).toHaveLength(1);
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(40), 'einlage', 2);
    processNarrativeBoundary(world, ledger);
    const facts = recentFacts(world, 'HOUSE_BALANCE');
    expect(facts).toHaveLength(2);
    expect(facts[1]!.kind === 'HOUSE_BALANCE' ? facts[1]!.band : 'LOW').toBe('OK');
  });

  it('drainiert die Queue nur einmal und verarbeitet Ledger- und Besucher-Facts gemeinsam', () => {
    const { world, ledger } = setup();
    openHouse(ledger, 0);
    processNarrativeBoundary(world, ledger);
    const visitor = recordVisitor(world, { name: 'Rita Probe', persona: 'STAMMGAST', tick: 0 });
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    ledger.transfer(HAUSKONTO, UTILITIES, fromVC(120), 'miete', 1);
    processNarrativeBoundary(world, ledger);
    expect(recentFacts(world, 'VISITOR_RETURNED')).toHaveLength(1);
    expect(recentFacts(world, 'HOUSE_BALANCE')).toHaveLength(1);
    expect(world.narrative.flags.rueckkehrer).toBe(1);
    processNarrativeBoundary(world, ledger);
    expect(recentFacts(world, 'VISITOR_RETURNED')).toHaveLength(1);
    expect(recentFacts(world, 'HOUSE_BALANCE')).toHaveLength(1);
  });

  it('normalisiert einen Hauskonto-Fact ohne visitorId und bewahrt Cursor und Band', () => {
    const fact = {
      id: 1, kind: 'HOUSE_BALANCE', tick: 3, day: 1, balance: fromVC(20), band: 'LOW',
    };
    const state = normalizeNarrativeState({
      factSeq: 2, processedId: 1, ledgerSeq: 4, houseBand: 'LOW', pending: [], recent: [fact],
    });
    expect(state.recent).toEqual([fact]);
    expect(state.ledgerSeq).toBe(4);
    expect(state.houseBand).toBe('LOW');
  });

  it('verwirft einen Hauskonto-Fact mit unbekanntem Band', () => {
    const state = normalizeNarrativeState({
      factSeq: 2, processedId: 0, pending: [
        { id: 1, kind: 'HOUSE_BALANCE', tick: 0, day: 0, balance: fromVC(20), band: 'UNBEKANNT' },
      ],
    });
    expect(state.pending).toEqual([]);
  });
});
