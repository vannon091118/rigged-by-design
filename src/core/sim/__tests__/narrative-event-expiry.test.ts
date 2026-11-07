/**
 * @test-target: src/core/sim/narrative/event-scheduler.ts
 * @error-code: ERR-2001
 *
 * D3: Keine globale Timeout-Strafe. `EXPIRED` bleibt wie heute ein reiner
 * Statuswechsel mit `DEADLINE`; der Fristablauf aendert weder Flags noch
 * Beziehungen noch Ledger-Zeilen und emittiert keinen Fact. Timeout-Effekte
 * gibt es nur als expliziten Template-Vertrag, falls sie spaeter noetig werden.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { maintainEvents, scheduleEvent } from '../narrative/event-scheduler';
import { templateFor } from '../narrative/events/definitions';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { shift } from '../narrative/relationships';
import { createWorld } from '../templates';
import type { TriggerMatch } from '../narrative/trigger-types';
import { recordVisitor } from '../visitors';

function fixture(status: 'OFFERED' | 'ACTIVE') {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Rita Frist', persona: 'STAMMGAST', tick: 0 });
  world.tick = 0;
  world.narrative.flags = { bestaendig: 7 };
  shift(world, `visitor:${visitor.id}`, 'player', { trust: 2 }, 0);
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'visitor-returned', matched: true, factId: 1,
    participants: [`visitor:${visitor.id}`], reasons: ['TEST'],
  };
  const candidate = createEventCandidate(templateFor('VISITOR_RETURN', 1)!, match)!;
  const event = scheduleEvent(world, candidate, status, world.tick)!;
  return {
    world, ledger, event,
    flags: { ...world.narrative.flags },
    relationships: world.narrative.relationships.map((edge) => ({ ...edge })),
    entries: ledger.entryCount,
    pending: world.narrative.pending.length,
  };
}

function expectUntouched(fixtureResult: ReturnType<typeof fixture>): void {
  const { world, ledger } = fixtureResult;
  expect(world.narrative.flags).toEqual(fixtureResult.flags);
  expect(world.narrative.relationships).toEqual(fixtureResult.relationships);
  expect(ledger.entryCount).toBe(fixtureResult.entries);
  expect(ledger.verifyIncremental()).toBe(true);
  expect(world.narrative.pending.length).toBe(fixtureResult.pending);
}

describe('Fristablauf ohne Strafe (D3)', () => {
  it('laesst ein OFFERED-Event fristgerecht und wirkungslos ablaufen', () => {
    const sealed = fixture('OFFERED');
    const result = maintainEvents(sealed.world, 31);
    expect(result.cancelled).toBe(0);
    expect(result.expired.map((entry) => entry.id)).toEqual([sealed.event.id]);
    const event = sealed.world.narrative.events.find((entry) => entry.id === sealed.event.id)!;
    expect(event.status).toBe('EXPIRED');
    expect(event.resolution).toBe('DEADLINE');
    expectUntouched(sealed);
  });

  it('laesst ein ACTIVE-Event fristgerecht und wirkungslos ablaufen', () => {
    const sealed = fixture('ACTIVE');
    const result = maintainEvents(sealed.world, 31);
    expect(result.cancelled).toBe(0);
    expect(result.expired).toHaveLength(1);
    expect(sealed.world.narrative.events.find((entry) => entry.id === sealed.event.id)?.status)
      .toBe('EXPIRED');
    expectUntouched(sealed);
  });
});
