/**
 * @test-target: src/core/sim/narrative/view.ts
 * @error-code: ERR-2001
 *
 * Das View-Modell leitet Szenen, Choices und Profile rein aus Welt, Ledger und
 * Composer ab; es entscheidet nichts und speichert nichts.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { createWorld } from '../../templates';
import { recordVisitor } from '../../visitors';
import { emitFact } from '../facts';
import { processNarrativeRuntime } from '../runtime';
import { buildNarrativeView } from '../view';

function scene() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const visitor = recordVisitor(world, { name: 'Rita Kern', persona: 'STAMMGAST', tick: 0 });
  emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
  processNarrativeRuntime(world, ledger);
  return { world, ledger, visitor };
}

describe('Narrative View (NAR-14)', () => {
  it('liefert die aktive Szene mit Text, Teilnehmern und Choices', () => {
    const { world, ledger, visitor } = scene();

    const view = buildNarrativeView(world, ledger);

    expect(view.events).toHaveLength(1);
    const event = view.events[0]!;
    expect(event.eventId).toBe('VISITOR_RETURN');
    expect(event.title.length).toBeGreaterThan(0);
    expect(event.body.length).toBeGreaterThan(0);
    expect(event.participants[0]).toMatchObject({ label: 'Rita Kern', visitorId: visitor.id });
    expect(event.choices.map((choice) => choice.choiceId)).toEqual(['WELCOME_BACK', 'ASK_ABOUT_LAST_VISIT']);
    expect(event.expiresInTicks).toBeGreaterThan(0);
  });

  it('sperrt eine abgelaufene Choice mit Grund, statt sie zu verschweigen', () => {
    const { world, ledger } = scene();

    world.tick += 400;
    const event = buildNarrativeView(world, ledger).events[0]!;

    expect(event.expiresInTicks).toBe(0);
    expect(event.choices.every((choice) => !choice.available)).toBe(true);
    expect(event.choices[0]!.reasons).toContain('EVENT_EXPIRED');
  });

  it('nennt den Grund einer gesperrten Choice, wenn eine Voraussetzung fehlt', () => {
    const { world, ledger } = scene();

    const blocked = buildNarrativeView(world, ledger).events[0]!.choices
      .find((choice) => choice.choiceId === 'ASK_ABOUT_LAST_VISIT');

    expect(blocked?.available).toBe(false);
    expect(blocked?.reasons).toContain('REQUIREMENT_NOT_MET');
  });

  it('zeigt Profile nur mit belegten Daten', () => {
    const { world, ledger, visitor } = scene();

    const profile = buildNarrativeView(world, ledger).profiles.find((entry) => entry.visitorId === visitor.id);

    expect(profile?.name).toBe('Rita Kern');
    expect(profile?.stories).toEqual(['VISITOR_RETURN']);
    expect(profile?.memories).toEqual([]);
    expect(profile?.relationships).toEqual([]);
  });

  it('ist deterministisch: gleiche Welt, gleiches Modell', () => {
    const { world, ledger } = scene();

    expect(buildNarrativeView(world, ledger)).toEqual(buildNarrativeView(world, ledger));
  });
});
