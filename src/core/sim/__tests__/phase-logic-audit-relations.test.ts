/**
 * @test-target: src/core/sim/narrative/relationships.ts | @error-code: ERR-2001
 *
 * Phase 3, 5 und 6 gegen die echten Pfade: Akteurswahrheit im Preflight,
 * Beziehungs-Invarianten, Dialog als reine Darstellung, View als reine Ableitung.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';
import { emitFact } from '../narrative/facts';
import { processNarrativeRuntime } from '../narrative/runtime';
import { scheduleEvent } from '../narrative/event-scheduler';
import { executeChoice } from '../narrative/commands/execute';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { isEventTemplate } from '../narrative/events/template-schema';
import type { EventTemplate } from '../narrative/events/template-types';
import type { TriggerMatch } from '../narrative/trigger-types';
import { relationshipBetween, normalizeRelationships, shift } from '../narrative/relationships';
import { buildNarrativeView } from '../narrative/view';
import { isDialogueScript, dialogueStart, dialogueStep } from '../narrative/dialogue/select';
import type { DialogueScript } from '../narrative/dialogue/types';

const ghostTemplate: EventTemplate = {
  eventId: 'PHASE_AUDIT_GHOST',
  version: 1,
  triggerId: 'visitor-returned',
  priority: 10,
  scope: 'VISITOR',
  participantRoles: ['visitor'],
  contentSlots: [
    { id: 'TITLE', kind: 'TITLE' },
    { id: 'BODY', kind: 'BODY' },
    { id: 'GHOST_TALK', kind: 'CHOICE_LABEL' },
  ],
  choices: [{
    choiceId: 'GHOST_TALK',
    labelSlotId: 'GHOST_TALK',
    outcomeId: 'GHOST_TALKED',
    requirements: [{ op: 'event-step', step: 'START' }],
    costs: [],
    effects: [{ kind: 'ADJUST_RELATIONSHIP', from: 'rival:GHOST', to: 'player', dimension: 'trust', delta: 1 }],
    followUpEventId: null,
  }],
  initialStep: 'START',
  expiresInTicks: 30,
  cooldownTicks: 10,
  maxOccurrences: 1,
};

function ghostFixture() {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Audit Rita', persona: 'STAMMGAST', tick: 0 });
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: ghostTemplate.triggerId, matched: true, factId: 1,
    participants: [`visitor:${visitor.id}`], reasons: ['AUDIT'],
  };
  const candidate = createEventCandidate(ghostTemplate, match);
  if (!candidate) throw new Error('Kandidat fehlt');
  const event = scheduleEvent(world, candidate, 'ACTIVE', 0);
  if (!event) throw new Error('Event fehlt');
  return { world, ledger, event };
}

describe('Phase 3 - Beziehungen und Akteurswahrheit', () => {
  it('klemmt Dimensionen und respektiert die Richtung', () => {
    const world = createWorld('SMALL');
    shift(world, 'player', 'visitor:1', { trust: 50 }, 1);
    expect(relationshipBetween(world, 'player', 'visitor:1')?.trust).toBe(10);
    expect(relationshipBetween(world, 'visitor:1', 'player')).toBeNull();
  });

  it('weist einen Choice-Effekt auf einen nicht existierenden Rivalen ab', () => {
    expect(isEventTemplate(ghostTemplate)).toBe(true);
    const { world, ledger, event } = ghostFixture();
    const result = executeChoice(world, ledger, event.id, 'GHOST_TALK', ghostTemplate);
    expect(result.rejections.map((entry) => entry.reason)).toContain('INVALID_TARGET');
    expect(relationshipBetween(world, 'rival:GHOST', 'player')).toBeNull();
  });

  it('haelt den Writer an denselben Invarianten wie die Normalisierung', () => {
    const world = createWorld('SMALL');
    shift(world, 'player', 'player', { trust: 2 }, 1);
    shift(world, 'visitor:1', 'player', { trust: Number.NaN }, 1);
    expect(relationshipBetween(world, 'player', 'player')).toBeNull();
    expect(Number.isFinite(relationshipBetween(world, 'visitor:1', 'player')?.trust)).toBe(true);
    expect(world.narrative.relationships).toEqual(normalizeRelationships(world.narrative.relationships));
  });
});

describe('Phase 5 - Kommunikation ist Darstellung, nicht Zustand', () => {
  const script: DialogueScript = {
    id: 'AUDIT_DIALOG', title: 'Audit', start: 'A',
    nodes: [
      { id: 'A', speaker: 'Rita', line: 'Hallo.', next: 'B', links: [{ id: 'GO', label: 'Weiter', target: 'NEXT' }] },
      { id: 'B', speaker: 'Du', line: 'Servus.', next: null, links: [{ id: 'END', label: 'Ende', target: 'CLOSE' }] },
    ],
  };

  it('fuehrt Dialoge fail-closed und ohne Weltmutation', () => {
    const world = createWorld('SMALL');
    const before = structuredClone(world);
    expect(isDialogueScript(script)).toBe(true);
    expect(dialogueStart(script)?.id).toBe('A');
    expect(dialogueStep(script, 'A', 'GO')).toEqual({ kind: 'NODE', nodeId: 'B' });
    expect(dialogueStep(script, 'A', 'FEHLT')).toBeNull();
    expect(dialogueStep(script, 'X', 'GO')).toBeNull();
    expect(world).toEqual(before);
    expect(isDialogueScript({ ...script, nodes: [{ ...script.nodes[0]!, next: 'FEHLT' }] })).toBe(false);
  });
});

describe('Phase 6 - Casino-Integration liest nur den einen Zustand', () => {
  it('leitet Profile rein aus Welt und Kanten ab, ohne den Zustand zu veraendern', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
    const visitor = recordVisitor(world, { name: 'Profil Test', persona: 'STAMMGAST', tick: 0 });
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    processNarrativeRuntime(world, ledger);
    const event = world.narrative.events.find((entry) => entry.eventId === 'VISITOR_RETURN');
    if (!event) throw new Error('Event fehlt');
    shift(world, `visitor:${visitor.id}`, 'player', { sympathy: 2 }, world.tick);
    const before = structuredClone(world);
    const first = buildNarrativeView(world, ledger);
    const second = buildNarrativeView(world, ledger);
    expect(first).toEqual(second);
    expect(world).toEqual(before);
    expect(first.events.some((entry) => entry.id === event.id)).toBe(true);
    const profile = first.profiles.find((entry) => entry.visitorId === visitor.id);
    expect(profile?.relationships[0]).toMatchObject({ to: 'player', sympathy: 2 });
  });
});
