/**
 * @test-target: src/core/sim/narrative/commands/execute.ts | @error-code: ERR-2001
 *
 * Phase 4 und 7 gegen die echten Pfade: Beat-Wechsel, Kosten, einmalige
 * Aufloesung und der Layout-Vertrag als einzige Raumwahrheit.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';
import { applyLayout } from '../layout';
import { layoutFromTemplate } from '../layout-derive';
import { parseLayout } from '../layout-validate';
import { scheduleEvent } from '../narrative/event-scheduler';
import { executeChoice } from '../narrative/commands/execute';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { isEventTemplate } from '../narrative/events/template-schema';
import type { EventTemplate } from '../narrative/events/template-types';
import type { TriggerMatch } from '../narrative/trigger-types';

const BASE = {
  costs: [] as const,
  effects: [] as const,
  followUpEventId: null,
  requirements: [] as const,
};

const multiBeat: EventTemplate = {
  eventId: 'PHASE_AUDIT_MULTI_BEAT',
  version: 1,
  triggerId: 'visitor-returned',
  priority: 10,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY' },
    { id: 'ASK', kind: 'CHOICE_LABEL' },
    { id: 'LEAVE', kind: 'CHOICE_LABEL' },
    { id: 'ANSWER', kind: 'CHOICE_LABEL' },
  ],
  choices: [
    {
      ...BASE, choiceId: 'ASK', labelSlotId: 'ASK', outcomeId: 'ASKED', nextStep: 'PROBE',
      requirements: [{ op: 'event-step', step: 'START' }],
      costs: [{ kind: 'VACOIN', amount: fromVC(10) }],
    },
    {
      ...BASE, choiceId: 'LEAVE', labelSlotId: 'LEAVE', outcomeId: 'LEFT', nextStep: null,
      requirements: [{ op: 'event-step', step: 'START' }],
    },
    {
      ...BASE, choiceId: 'ANSWER', labelSlotId: 'ANSWER', outcomeId: 'ANSWERED', nextStep: null,
      requirements: [{ op: 'event-step', step: 'PROBE' }],
      costs: [{ kind: 'VACOIN', amount: fromVC(5) }],
    },
  ],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 10,
  maxOccurrences: 1,
};

function fixture() {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Beat Test', persona: 'STAMMGAST', tick: 0 });
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: multiBeat.triggerId, matched: true, factId: 1,
    participants: [`visitor:${visitor.id}`], reasons: ['AUDIT'],
  };
  const candidate = createEventCandidate(multiBeat, match);
  if (!candidate) throw new Error('Kandidat fehlt');
  const event = scheduleEvent(world, candidate, 'ACTIVE', 0);
  if (!event) throw new Error('Event fehlt');
  return { world, ledger, event };
}

describe('Phase 4 - Narrative Uebergaenge', () => {
  it('wechselt den Beat ohne Aufloesung und bucht die Kosten genau einmal', () => {
    expect(isEventTemplate(multiBeat)).toBe(true);
    const { world, ledger, event } = fixture();
    const before = ledger.getBalance(HAUSKONTO);
    const result = executeChoice(world, ledger, event.id, 'ASK', multiBeat);
    expect(result.ok).toBe(true);
    expect(result.event?.status).toBe('ACTIVE');
    expect(result.event?.step).toBe('PROBE');
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(10));
    expect(world.narrative.pending.some((fact) => fact.kind === 'EVENT_RESOLVED')).toBe(false);
  });

  it('loest nur im letzten Beat auf, genau einmal, und verbucht jede Buchung', () => {
    const { world, ledger, event } = fixture();
    const before = ledger.getBalance(HAUSKONTO);
    expect(executeChoice(world, ledger, event.id, 'ASK', multiBeat).ok).toBe(true);
    const final = executeChoice(world, ledger, event.id, 'ANSWER', multiBeat);
    expect(final.event?.status).toBe('RESOLVED');
    expect(final.event?.resolution).toBe('ANSWERED');
    expect(world.narrative.pending.filter((fact) => fact.kind === 'EVENT_RESOLVED')).toHaveLength(1);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(15));
    const repeat = executeChoice(world, ledger, event.id, 'ANSWER', multiBeat);
    expect(repeat.ok).toBe(false);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(15));
    expect(world.narrative.pending.filter((fact) => fact.kind === 'EVENT_RESOLVED')).toHaveLength(1);
  });

  it('weist eine Choice des spaeteren Beats ohne Nebenwirkung ab', () => {
    const { world, ledger, event } = fixture();
    const before = structuredClone(world.narrative);
    const house = ledger.getBalance(HAUSKONTO);
    expect(executeChoice(world, ledger, event.id, 'ANSWER', multiBeat).ok).toBe(false);
    expect(world.narrative.events).toEqual(before.events);
    expect(world.narrative.relationships).toEqual(before.relationships);
    expect(ledger.getBalance(HAUSKONTO)).toBe(house);
  });
});

describe('Phase 7 - Raumgeometrie aus dem Layout-Vertrag', () => {
  it('validiert Layouts fail-closed und leitet Groesse und Zonen aus einer Quelle ab', () => {
    const world = createWorld('SMALL');
    applyLayout(world, layoutFromTemplate('SMALL'));
    const roundtrip = parseLayout(JSON.parse(JSON.stringify(world.layout)));
    expect(roundtrip.ok).toBe(true);
    if (!roundtrip.ok) throw new Error(roundtrip.issues.join(' '));
    expect(roundtrip.layout.zones).toEqual(world.layout.zones);
    expect(roundtrip.layout.size).toBe(world.size);
    const duplicate = { ...roundtrip.layout, edges: [...world.layout.edges, world.layout.edges[0]!] };
    expect(parseLayout(duplicate).ok).toBe(false);
    const outside = {
      ...roundtrip.layout,
      zones: [{ ...world.layout.zones[0]!, x: world.size, w: 2 }],
    };
    expect(parseLayout(outside).ok).toBe(false);
  });
});
