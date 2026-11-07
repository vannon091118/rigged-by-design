/**
 * @test-target: src/core/sim/narrative/events/trigger-definitions.ts | @error-code: ERR-2001
 *
 * F: Langzeitpfad ohne Campaign-State. VISITOR_RETURN fuehrt per ASK in
 * VISITOR_AFTERMATH und hinterlaesst Flag plus Beziehung; ein spaeterer
 * VISITOR_RETURNED-Fact mit GOOD-Erinnerung matcht die zweite Stufe
 * `visitor-returned-warm` zusaetzlich zur Basis - nur mit vorhandener
 * Trigger-/Cooldown-Infrastruktur, ohne Template-Requirements.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { buildNarrativeView } from '../narrative/view';
import { emitFact } from '../narrative/facts';
import { executeChoice } from '../narrative/commands/execute';
import { EVENT_TEMPLATES, templateFor } from '../narrative/events/definitions';
import { EVENT_TRIGGER_DEFINITIONS } from '../narrative/events/trigger-definitions';
import { relationshipBetween } from '../narrative/relationships';
import { processNarrativeRuntime } from '../narrative/runtime';
import { valenceOf } from '../narrative/memory';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';

function returnedWorld(valence: 'GOOD' | 'BAD') {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Rita Warm', persona: 'STAMMGAST', tick: 0 });
  world.narrative.flags = { startpool: 1 };
  const score = valence === 'GOOD' ? 90 : 10;
  visitor.memories = [{ factId: 1, tick: 0, score, valence }];
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
  const result = processNarrativeRuntime(world, ledger);
  return { world, visitor, ledger, result };
}

describe('Warme Rueckkehr als zweite Stufe (F)', () => {
  it('haelt die Variante als deklarative Trigger-Definition mit eigenem Template', () => {
    const definition = EVENT_TRIGGER_DEFINITIONS.find((entry) => entry.id === 'visitor-returned-warm');
    expect(definition?.condition).toEqual({
      op: 'all',
      conditions: [
        { op: 'fact', kind: 'VISITOR_RETURNED' },
        { op: 'visitor-memory', valence: 'GOOD' },
      ],
    });
    const templates = EVENT_TEMPLATES.filter((template) => template.triggerId === 'visitor-returned-warm');
    expect(templates.map((template) => template.eventId)).toEqual(['VISITOR_RETURN_WARM']);
    expect(templateFor('VISITOR_RETURN_WARM', 1)?.scope).toBe('VISITOR');
  });

  it('plant bei GOOD-Erinnerung zusaetzlich die warme Szene, bei BAD nur die Basis', () => {
    const warm = returnedWorld('GOOD');
    const warmIds = warm.result.scheduled.map((entry) => entry.eventId);
    expect(warmIds).toContain('VISITOR_RETURN');
    expect(warmIds).toContain('VISITOR_RETURN_WARM');
    const warmEvent = warm.result.scheduled.find((entry) => entry.eventId === 'VISITOR_RETURN_WARM')!;
    expect(warmEvent.status).toBe('OFFERED');
    expect(warmEvent.participants).toEqual([`visitor:${warm.visitor.id}`]);
    expect(warmEvent.priority).toBeGreaterThan(
      warm.result.scheduled.find((entry) => entry.eventId === 'VISITOR_RETURN')!.priority,
    );

    const cold = returnedWorld('BAD');
    expect(cold.result.scheduled.map((entry) => entry.eventId)).toEqual(['VISITOR_RETURN']);
  });

  it('spricht die warme Szene aus dem eigenen Textpool, nicht aus dem Basistopf', () => {
    const { world, ledger, result } = returnedWorld('GOOD');
    expect(result.scheduled.some((entry) => entry.eventId === 'VISITOR_RETURN_WARM')).toBe(true);
    const view = buildNarrativeView(world, ledger);
    const warm = view.events.find((entry) => entry.eventId === 'VISITOR_RETURN_WARM')!;
    expect(warm.title).toBe('Er tritt ein, als hätte dieser Abend schon auf ihn gewartet.');
    expect(warm.body).toContain('erinnert es sich gern');
    expect(warm.choices.map((choice) => choice.choiceId)).toEqual(['WARM_WELCOME']);
    expect(warm.choices[0]?.label).toBe('Ihn mit Namen begrüßen und den gewohnten Platz anbieten.');
    expect(warm.fallbackSlots).not.toContain('TITLE');
    expect(warm.fallbackSlots).not.toContain('BODY');
    expect(warm.fallbackSlots).not.toContain('CHOICE_WARM');
  });

  it('fuehrt den Langzeitpfad Kette -> Flag/Beziehung -> spaeteres Warm-Match ohne Campaign-State', () => {
    const world = createWorld('SMALL');
    const visitor = recordVisitor(world, { name: 'Rita Lang', persona: 'STAMMGAST', tick: 0 });
    world.narrative.flags = { startpool: 1 };
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });

    // Erste Rueckkehr ohne Erinnerung: nur die Basis-Szene.
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 1 });
    const first = processNarrativeRuntime(world, ledger);
    expect(first.scheduled.map((entry) => entry.eventId)).toEqual(['VISITOR_RETURN']);

    // Kette: ASK setzt das Flag, AFTERMATH folgt, LISTEN setzt Vertrauen.
    const base = first.scheduled.find((entry) => entry.eventId === 'VISITOR_RETURN')!;
    expect(executeChoice(world, ledger, base.id, 'ASK_ABOUT_LAST_VISIT').ok).toBe(true);
    expect(world.narrative.flags.asked_about_visit).toBe(1);
    const chained = processNarrativeRuntime(world, ledger);
    const aftermath = chained.scheduled.find((entry) => entry.eventId === 'VISITOR_AFTERMATH')!;
    expect(executeChoice(world, ledger, aftermath.id, 'LISTEN_ON').ok).toBe(true);
    expect(relationshipBetween(world, `visitor:${visitor.id}`, 'player')?.trust).toBe(1);

    // Guter Abend schreibt die Erinnerung; spaeter matcht die zweite Stufe.
    emitFact(world, {
      kind: 'VISIT_ENDED', visitorId: visitor.id, guestId: 1, score: 90, valence: valenceOf(90),
    });
    processNarrativeRuntime(world, ledger);
    expect(visitor.memories?.some((memory) => memory.valence === 'GOOD')).toBe(true);
    world.tick += 25;
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    const later = processNarrativeRuntime(world, ledger);
    expect(later.scheduled.map((entry) => entry.eventId)).toContain('VISITOR_RETURN_WARM');
    // Flag und Beziehung haben ueberlebt (der gute Abend vertieft sie sogar); kein Campaign-State noetig.
    expect(world.narrative.flags.asked_about_visit).toBe(1);
    expect(relationshipBetween(world, `visitor:${visitor.id}`, 'player')?.trust).toBeGreaterThanOrEqual(1);
    expect(world).not.toHaveProperty('campaign');
  });
});
