/**
 * @test-target: src/store/narrative-commands.ts
 * @error-code: ERR-2001
 *
 * Die Store-Naht drainiert Facts an der Mutationsgrenze und fuehrt Choices aus.
 * Eine aufgeloeste Choice ist selbst wieder ein Fact und wird genau einmal verarbeitet.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { emitFact } from '../../core/sim/narrative/facts';
import { relationshipBetween } from '../../core/sim/narrative/relationships';
import { createWorld } from '../../core/sim/templates';
import { recordVisitor } from '../../core/sim/visitors';
import { chooseNarrativeCmd, flushNarrativeCmd } from '../narrative-commands';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const visitor = recordVisitor(world, { name: 'Rita Test', persona: 'STAMMGAST', tick: 0 });
  emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
  return { world, ledger, visitor };
}

function firstEvent(world: ReturnType<typeof createWorld>) {
  const event = world.narrative.events[0];
  if (!event) throw new Error('Event fehlt');
  return event;
}

describe('Narrative Store-Commands', () => {
  it('drainiert Facts an der Store-Grenze und plant das Event', () => {
    const { world, ledger } = setup();

    const result = flushNarrativeCmd(world, ledger);

    expect(result.processed).toBe(1);
    expect(result.scheduled.map((event) => event.eventId)).toEqual(['VISITOR_RETURN']);
    expect(world.narrative.pending).toHaveLength(0);
    expect(flushNarrativeCmd(world, ledger).processed).toBe(0);
  });

  it('schliesst den Kreis Fact->Event->Choice->Command->Fact', () => {
    const { world, ledger, visitor } = setup();
    flushNarrativeCmd(world, ledger);

    const execution = chooseNarrativeCmd(world, ledger, firstEvent(world).id, 'WELCOME_BACK');

    expect(execution.ok).toBe(true);
    expect(execution.event?.status).toBe('RESOLVED');
    expect(execution.event?.resolution).toBe('WELCOMED');
    expect(relationshipBetween(world, `visitor:${visitor.id}`, 'player')?.sympathy).toBe(1);
    expect(world.narrative.pending.at(-1)).toMatchObject({
      kind: 'EVENT_RESOLVED', eventKind: 'VISITOR_RETURN', choiceId: 'WELCOME_BACK', outcomeId: 'WELCOMED',
    });

    const flushed = flushNarrativeCmd(world, ledger);

    expect(flushed.processed).toBe(1);
    expect(world.narrative.pending).toHaveLength(0);
    expect(world.narrative.recent.at(-1)?.kind).toBe('EVENT_RESOLVED');
    expect(flushNarrativeCmd(world, ledger).processed).toBe(0);
  });

  it('macht eine abgewiesene Choice als Fact sichtbar, ohne das Event zu bewegen', () => {
    const { world, ledger } = setup();
    flushNarrativeCmd(world, ledger);
    const statusBefore = firstEvent(world).status;

    const execution = chooseNarrativeCmd(world, ledger, firstEvent(world).id, 'UNBEKANNT');

    expect(execution.ok).toBe(false);
    expect(firstEvent(world).status).toBe(statusBefore);
    expect(relationshipBetween(world, 'visitor:1', 'player')).toBeNull();
    expect(world.narrative.pending.at(-1)).toMatchObject({ kind: 'COMMAND_REJECTED', commandId: 'UNBEKANNT' });
    expect(flushNarrativeCmd(world, ledger).processed).toBe(1);
    expect(world.narrative.recent.at(-1)?.kind).toBe('COMMAND_REJECTED');
  });

  it('fuehrt eine bereits aufgeloeste Choice nicht ein zweites Mal aus', () => {
    const { world, ledger, visitor } = setup();
    flushNarrativeCmd(world, ledger);
    expect(chooseNarrativeCmd(world, ledger, firstEvent(world).id, 'WELCOME_BACK').ok).toBe(true);
    flushNarrativeCmd(world, ledger);

    const repeat = chooseNarrativeCmd(world, ledger, firstEvent(world).id, 'WELCOME_BACK');

    expect(repeat.ok).toBe(false);
    expect(repeat.rejections.map((entry) => entry.reason)).toContain('EVENT_NOT_LIVE');
    expect(relationshipBetween(world, `visitor:${visitor.id}`, 'player')?.sympathy).toBe(1);
    expect(world.narrative.pending.at(-1)?.kind).toBe('COMMAND_REJECTED');
  });
});
