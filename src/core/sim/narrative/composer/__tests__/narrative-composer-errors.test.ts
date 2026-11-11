/**
 * @test-target: src/core/sim/narrative/composer/index.ts
 * @error-code: ERR-4022
 *
 * NAR-11: Die Fehlerpfade des Runtime-Composers lehnen ungueltige Direktiven,
 * leere Fragmente und doppelte Slot-IDs fail-closed ab. Kein Test braucht
 * Zeit, Netzwerk oder Gameplay-PRNG.
 */
import { describe, expect, it } from 'vitest';
import { composeNarrative, type ComposeRequest, type ComposedNarrative } from '../index';
import { NARRATIVE_REGISTRY } from '../registry.generated';
import { VISITOR_RETURN_TEMPLATE } from '../../events/definitions/visitor-return';

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

describe('Narrative Runtime Composer (NAR-11) – Fehlerpfade', () => {
  it('weist ungueltige Direktiven zurueck, ohne das Fragment zu verwenden', () => {
    const baseline = NARRATIVE_REGISTRY.find((entry) => entry.contributionId === 'trigger-context-01');
    if (!baseline) throw new Error('Baseline-Fragment fehlt');
    const invalid = {
      ...baseline,
      contributionId: 'invalid-directive-01',
      directives: [{ id: 'FREEZE_TICK', ticks: 999 }],
    };
    const result = composeNarrative(
      { ...RETURN_REQUEST, slots: [{ id: 'BODY', kind: 'BODY' as const }] },
      [invalid, ...(NARRATIVE_REGISTRY as readonly unknown[])],
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
      { ...RETURN_REQUEST, slots: [{ id: 'BODY', kind: 'BODY' as const }] },
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
});
