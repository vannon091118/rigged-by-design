/** @test-target: src/core/sim/narrative/commands/execute.ts | @error-code: ERR-2001
 *
 * P-15: TRIGGER_DIALOG ist ausfuehrbar. Der Command schreibt bewusst keinen
 * Weltzustand (der Dialog haelt ueber Speichern/Laden nichts); der einzige
 * Uebergabepunkt ist das ausgefuehrte Command im Choice-Ergebnis, aus dem die
 * UI das referenzierte Skript oeffnet. Unbekannte Dialog-IDs lehnt der
 * Preflight fail-closed ab.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { createEventCandidate } from '../narrative/events/template-candidate';
import { templateFor } from '../narrative/events/definitions';
import { scheduleEvent } from '../narrative/event-scheduler';
import type { EventTemplate } from '../narrative/events/template-types';
import type { TriggerMatch } from '../narrative/trigger-types';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';
import { executeChoice } from '../narrative/commands/execute';

const base = templateFor('VISITOR_RETURN', 1)!;

const dialogTemplate = (dialogId: string, choiceId: string): EventTemplate => ({
  ...base,
  eventId: 'DIALOG_VISITOR_RETURN',
  choices: [{
    ...base.choices[0]!,
    choiceId,
    effects: [{ kind: 'TRIGGER_DIALOG', dialogId }],
  }],
});

function fixture(activeTemplate: EventTemplate) {
  const world = createWorld('SMALL');
  const visitor = recordVisitor(world, { name: 'Rita Test', persona: 'STAMMGAST', tick: 0 });
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'visitor-returned', matched: true, factId: 1,
    participants: [`visitor:${visitor.id}`], reasons: ['TEST'],
  };
  const candidate = createEventCandidate(activeTemplate, match)!;
  const event = scheduleEvent(world, candidate, 'ACTIVE', 0)!;
  return { world, ledger, event };
}


describe('TRIGGER_DIALOG (P-15)', () => {
  it('liefert die Dialog-ID im ausgefuehrten Command und veraendert sonst nichts', () => {
    const template = dialogTemplate('rita-am-tresen', 'OPEN_DIALOG');
    const { world, ledger, event } = fixture(template);
    const entries = ledger.entryCount;
    const flagsBefore = { ...world.narrative.flags };

    const result = executeChoice(world, ledger, event.id, 'OPEN_DIALOG', template);

    expect(result.ok).toBe(true);
    expect(result.event?.status).toBe('RESOLVED');
    expect(result.commands).toMatchObject([{ id: 'TRIGGER_DIALOG', dialogId: 'rita-am-tresen' }]);
    expect(ledger.entryCount).toBe(entries);
    expect(world.narrative.flags).toEqual(flagsBefore);
    expect(ledger.verifyIncremental()).toBe(true);
  });

  it('lehnt eine unbekannte Dialog-ID fail-closed ab, ohne die Welt zu bewegen', () => {
    const template = dialogTemplate('gibt-es-nicht', 'OPEN_MISSING');
    const { world, ledger, event } = fixture(template);
    const entries = ledger.entryCount;

    const result = executeChoice(world, ledger, event.id, 'OPEN_MISSING', template);

    expect(result.ok).toBe(false);
    expect(result.rejections.map((entry) => entry.reason)).toContain('INVALID_TARGET');
    expect(event.status).toBe('ACTIVE');
    expect(ledger.entryCount).toBe(entries);
    expect(world.narrative.pending.at(-1)?.kind).toBe('COMMAND_REJECTED');
  });
});
