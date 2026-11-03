/**
 * @test-target: src/core/sim/narrative/composer/index.ts
 * @error-code: ERR-4022
 *
 * NAR-11: Der Composer waehlt aus der validierten Registry deterministisch
 * Texte, liefert fuer fehlende Slots lokale Fallbacks und reicht Direktiven
 * nur als AST weiter. Kein Test braucht Zeit, Netzwerk oder Gameplay-PRNG.
 */
import { describe, expect, it } from 'vitest';
import { composeNarrative, type ComposeRequest, type ComposedNarrative } from '../narrative/composer';
import { NARRATIVE_REGISTRY } from '../narrative/composer/registry.generated';
import { VISITOR_CONFLICT_TEMPLATE } from '../narrative/events/definitions/visitor-conflict';
import { VISITOR_RETURN_TEMPLATE } from '../narrative/events/definitions/visitor-return';

const RETURN_REQUEST: ComposeRequest = {
  locale: 'de',
  slots: VISITOR_RETURN_TEMPLATE.contentSlots,
  contexts: ['return'],
  requiredFlags: ['narrativ', 'rueckkehrer'],
  availablePersonas: ['rita-kern'],
};

const slot = (result: ComposedNarrative, id: string) => {
  const found = result.slots.find((entry) => entry.slotId === id);
  if (!found) throw new Error(`Slot ${id} fehlt`);
  return found;
};

describe('Narrative Runtime Composer (NAR-11)', () => {
  it('setzt alle Template-Slots vollstaendig zusammen und markiert Fallbacks', () => {
    const result = composeNarrative(RETURN_REQUEST);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.slots).toHaveLength(VISITOR_RETURN_TEMPLATE.contentSlots.length);
    expect(result.slots.every((entry) => entry.text.length > 0)).toBe(true);
    expect(slot(result, 'BODY').contributionId).toBe('trigger-context-01');
    expect(slot(result, 'BODY').fallback).toBe(false);
    expect(slot(result, 'TITLE').fallback).toBe(true);
    expect(result.fallbacks).toEqual([
      'TITLE', 'CHOICE_WELCOME', 'CHOICE_ASK', 'OUTCOME_WELCOMED', 'OUTCOME_ASKED',
    ]);
  });

  it('liefert bei identischer Anfrage und anderer Registry-Reihenfolge dasselbe Ergebnis', () => {
    const forward = composeNarrative(RETURN_REQUEST);
    const reverse = composeNarrative(RETURN_REQUEST, [...NARRATIVE_REGISTRY].reverse());
    expect(reverse).toEqual(forward);
    expect(forward.rejected).toEqual([]);
  });

  it('waehlt fuer Konflikt und Service passende Fragmente statt beliebiger Texte', () => {
    const result = composeNarrative({
      locale: 'de',
      slots: VISITOR_CONFLICT_TEMPLATE.contentSlots,
      contexts: ['conflict', 'service'],
      requiredFlags: ['narrativ'],
      availablePersonas: ['rita-kern'],
    });
    expect(result.ok).toBe(true);
    expect(slot(result, 'BODY').contributionId).toBe('nar-04-beziehungsquellen-01');
    expect(slot(result, 'OUTCOME_DEFUSED').contributionId).toBe('till-watch-01');
    expect(slot(result, 'CHOICE_DEFUSE').fallback).toBe(true);
  });

  it('verwirft Locale- und Persona-Inkompatibilitaeten fail-closed', () => {
    const withoutPersona = composeNarrative({ ...RETURN_REQUEST, availablePersonas: [] });
    expect(slot(withoutPersona, 'BODY').fallback).toBe(true);
    expect(slot(withoutPersona, 'BODY').contributionId).toBeNull();

    const english = composeNarrative({ ...RETURN_REQUEST, locale: 'en' });
    expect(english.slots.every((entry) => entry.fallback)).toBe(true);
    expect(english.fallbacks).toHaveLength(english.slots.length);
  });

  it('weist ungueltige Direktiven zurueck, ohne das Fragment zu verwenden', () => {
    const baseline = NARRATIVE_REGISTRY.find((entry) => entry.contributionId === 'trigger-context-01');
    if (!baseline) throw new Error('Baseline-Fragment fehlt');
    const invalid = {
      ...baseline,
      contributionId: 'invalid-directive-01',
      directives: [{ id: 'FREEZE_TICK', ticks: 999 }],
    };
    const result = composeNarrative(
      { ...RETURN_REQUEST, slots: [{ id: 'BODY', kind: 'BODY' }] },
      [invalid, ...NARRATIVE_REGISTRY],
    );
    expect(result.rejected).toContainEqual({
      contributionId: 'invalid-directive-01',
      reason: 'INVALID_DIRECTIVE',
    });
    expect(slot(result, 'BODY').contributionId).toBe('trigger-context-01');
  });

  it('weist ungueltige Fragmente zurueck und meldet den Grund', () => {
    const baseline = NARRATIVE_REGISTRY.find((entry) => entry.contributionId === 'trigger-context-01');
    if (!baseline) throw new Error('Baseline-Fragment fehlt');
    const invalid = { ...baseline, contributionId: 'invalid-text-01', text: '' };
    const result = composeNarrative(
      { ...RETURN_REQUEST, slots: [{ id: 'BODY', kind: 'BODY' }] },
      [invalid],
    );
    expect(result.rejected).toContainEqual({ contributionId: 'invalid-text-01', reason: 'INVALID_FRAGMENT' });
    expect(slot(result, 'BODY').fallback).toBe(true);
  });

  it('liefert fuer ungueltige Anfragen kein Teil-Ergebnis', () => {
    const result = composeNarrative({
      ...RETURN_REQUEST,
      slots: [{ id: 'BODY', kind: 'BODY' }, { id: 'BODY', kind: 'BODY' }],
    });
    expect(result.ok).toBe(false);
    expect(result.slots).toEqual([]);
    expect(result.issues).toHaveLength(1);
  });

  it('reicht Direktiven unveraendert weiter, ohne Text oder Mechanik zu koppeln', () => {
    const baseline = NARRATIVE_REGISTRY.find((entry) => entry.contributionId === 'trigger-context-01');
    if (!baseline) throw new Error('Baseline-Fragment fehlt');
    const original = {
      ...baseline,
      contributionId: 'directive-original-01',
      directives: [{ id: 'FREEZE_TICK', ticks: 12 }],
    };
    const changedText = { ...original, contributionId: 'directive-changed-01', text: 'Ein anderer Text.' };
    const request = { ...RETURN_REQUEST, slots: [{ id: 'BODY', kind: 'BODY' }] };
    const first = composeNarrative(request, [original]);
    const second = composeNarrative(request, [changedText]);
    expect(slot(first, 'BODY').directives).toEqual([{ id: 'FREEZE_TICK', ticks: 12 }]);
    expect(slot(second, 'BODY').directives).toEqual(slot(first, 'BODY').directives);
    expect(slot(second, 'BODY').text).toBe('Ein anderer Text.');
  });

  it('nutzt fuer jeden Slot-Kind einen lokalen, nicht-leeren Fallback', () => {
    const result = composeNarrative({
      locale: 'de',
      slots: [
        { id: 'T', kind: 'TITLE' },
        { id: 'B', kind: 'BODY' },
        { id: 'C', kind: 'CHOICE_LABEL' },
        { id: 'O', kind: 'OUTCOME' },
      ],
      contexts: ['kein-treffer'],
    });
    expect(result.ok).toBe(true);
    expect(result.slots.map((entry) => entry.kind)).toEqual(['TITLE', 'BODY', 'CHOICE_LABEL', 'OUTCOME']);
    expect(result.slots.every((entry) => entry.fallback && entry.text.length > 0)).toBe(true);
    expect(result.slots.find((entry) => entry.kind === 'CHOICE_LABEL')?.text).toBe('Weiter');
  });
});
