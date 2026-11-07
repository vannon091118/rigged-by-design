/**
 * @test-target: src/core/economy/ledger.ts | @error-code: ERR-2001
 *
 * Phase 0-2 gegen die echten Pfade: Geld, Determinismus, Akteurskanten, Weltzeit,
 * Fact-Kreis. Geprueft wird Laufzeitverhalten, nicht Dateiexistenz.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { HAUSKONTO } from '../money';
import { tickWorld } from '../tick';
import { TICKS_PER_DAY } from '../demand';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';
import { emitFact } from '../narrative/facts';
import { processNarrativeRuntime } from '../narrative/runtime';
import { normalizeRelationships } from '../narrative/relationships';
import { chooseNarrativeCmd, flushNarrativeCmd } from '../../../store/narrative-commands';

describe('Phase 0 - Geld und Determinismus', () => {
  it('haelt die Bilanz ueber Einzahlung, Buchung und Schuld bei Null', () => {
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    ledger.openLiability('HAUS_SCHULDEN');
    ledger.transfer(HAUSKONTO, 'PORTEMONNAIE', fromVC(30), 'test', 1);
    ledger.transfer('HAUS_SCHULDEN', 'PENDING_1', fromVC(10), 'kredit', 1);
    const sum = Object.values(ledger.snapshot()).reduce((total, value) => total + value, 0);
    expect(sum).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('laesst einen abgelehnten Transfer ohne Saldo- oder Zeilenaenderung', () => {
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(5) });
    const before = ledger.snapshot();
    const entries = ledger.entryCount;
    expect(() => ledger.transfer(HAUSKONTO, 'PORTEMONNAIE', fromVC(6), 'zu teuer', 1)).toThrow();
    expect(ledger.snapshot()).toEqual(before);
    expect(ledger.entryCount).toBe(entries);
  });

  it('ist aus demselben Seed reproduzierbar', () => {
    const a = new Prng(7);
    const b = new Prng(7);
    expect([a.nextUint32(), a.nextUint32()]).toEqual([b.nextUint32(), b.nextUint32()]);
  });

  it('normalisiert Kanten fail-closed: keine Selbstkante, geklemmt, first-wins je Richtung', () => {
    const normalized = normalizeRelationships([
      { from: 'player', to: 'player', trust: 3 },
      { from: 'player', to: 'visitor:1', trust: 99, updatedTick: 1 },
      { from: 'player', to: 'visitor:1', trust: -99, updatedTick: 2 },
      { from: 'visitor:1', to: 'player', sympathy: 4, updatedTick: 3 },
    ]);
    expect(normalized).toHaveLength(2);
    expect(normalized.find((edge) => edge.to === 'visitor:1')?.trust).toBe(10);
    expect(normalized.find((edge) => edge.from === 'visitor:1')?.sympathy).toBe(4);
  });
});

describe('Phase 1 - eine autoritative Weltzeit', () => {
  it('zaehlt Tick und Tag genau einmal an der Tagesgrenze', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const prng = new Prng(1);
    const startDay = world.day;
    for (let tick = 0; tick < TICKS_PER_DAY - 1; tick += 1) tickWorld(world, ledger, prng);
    expect(world.tick).toBe(TICKS_PER_DAY - 1);
    expect(world.day).toBe(startDay);
    tickWorld(world, ledger, prng);
    expect(world.tick).toBe(TICKS_PER_DAY);
    expect(world.day).toBe(startDay + 1);
  });
});

describe('Phase 2 - Identitaet und Ereignisfluss', () => {
  it('verarbeitet einen Fact genau einmal und schliesst den Kreis Fact-Event-Choice-Fact', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    const visitor = recordVisitor(world, { name: 'Kreis Test', persona: 'STAMMGAST', tick: 0 });
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    expect(processNarrativeRuntime(world, ledger).processed).toBe(1);
    expect(processNarrativeRuntime(world, ledger).processed).toBe(0);
    const event = world.narrative.events.find((entry) => entry.eventId === 'VISITOR_RETURN');
    if (!event) throw new Error('Event fehlt');
    expect(chooseNarrativeCmd(world, ledger, event.id, 'WELCOME_BACK').ok).toBe(true);
    expect(world.narrative.pending.filter((fact) => fact.kind === 'EVENT_RESOLVED')).toHaveLength(1);
    expect(flushNarrativeCmd(world, ledger).processed).toBe(1);
    expect(flushNarrativeCmd(world, ledger).processed).toBe(0);
    expect(world.narrative.recent.filter((fact) => fact.kind === 'EVENT_RESOLVED')).toHaveLength(1);
  });
});
