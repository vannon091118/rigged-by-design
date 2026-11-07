/**
 * @test-target: src/core/sim/narrative/runtime.ts
 * @error-code: ERR-2001
 *
 * D1: Eine aufgeloeste Choice mit `followUpEventId` erzeugt im naechsten Lauf
 * genau ein Folge-Event als OFFERED mit `chainFromEventId`; der zweite Lauf
 * erzeugt kein Duplikat. Keine Rekursion: Der Lauf verarbeitet nur den
 * bereits drainierten Fact.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { executeChoice } from '../narrative/commands/execute';
import { scheduleEvent } from '../narrative/event-scheduler';
import { templateFor } from '../narrative/events/definitions';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { processNarrativeRuntime } from '../narrative/runtime';
import { createWorld } from '../templates';
import type { TriggerMatch } from '../narrative/trigger-types';
import { recordVisitor } from '../visitors';

function askedWorld() {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Rita Kette', persona: 'STAMMGAST', tick: 0 });
  world.narrative.flags = { startpool: 1 };
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'visitor-returned', matched: true, factId: 1,
    participants: [`visitor:${visitor.id}`], reasons: ['TEST'],
  };
  const candidate = createEventCandidate(templateFor('VISITOR_RETURN', 1)!, match)!;
  const event = scheduleEvent(world, candidate, 'OFFERED', 0)!;
  const executed = executeChoice(world, ledger, event.id, 'ASK_ABOUT_LAST_VISIT');
  expect(executed.ok).toBe(true);
  return { world, visitor, priorId: event.id };
}

describe('Choice-Folgekette (D1)', () => {
  it('plant nach ASK_ABOUT_LAST_VISIT genau ein VISITOR_AFTERMATH als OFFERED', () => {
    const { world, visitor, priorId } = askedWorld();
    const result = processNarrativeRuntime(world, new Ledger());
    const follow = result.scheduled.find((entry) => entry.eventId === 'VISITOR_AFTERMATH');
    expect(follow?.eventId).toBe('VISITOR_AFTERMATH');
    expect(follow?.status).toBe('OFFERED');
    expect(follow?.chainFromEventId).toBe(priorId);
    expect(follow?.participants).toEqual([`visitor:${visitor.id}`]);
    expect(result.scheduled.filter((entry) => entry.eventId === 'VISITOR_AFTERMATH')).toHaveLength(1);
  });

  it('erzeugt im zweiten Lauf kein Duplikat', () => {
    const { world, priorId } = askedWorld();
    const first = processNarrativeRuntime(world, new Ledger());
    expect(first.scheduled.some((entry) => entry.eventId === 'VISITOR_AFTERMATH')).toBe(true);
    const count = world.narrative.events.length;
    const second = processNarrativeRuntime(world, new Ledger());
    expect(second.scheduled).toEqual([]);
    expect(world.narrative.events.length).toBe(count);
    expect(world.narrative.events.filter((entry) => entry.chainFromEventId === priorId)).toHaveLength(1);
  });
});
