/**
 * @vitest-environment jsdom
 * @test-target: src/ui/dialog-request.ts
 * @error-code: ERR-3001
 *
 * Der Router oeffnet genau dann einen Dialog, wenn eine aufgeloeste Choice
 * einen TRIGGER_DIALOG traegt - sonst bleibt das Popup zu. Abgewiesene
 * Choices oeffnen nie einen Dialog, auch wenn sie den Command nennen.
 */
import { describe, expect, it } from 'vitest';
import type { ChoiceExecution, NarrativeCommand } from '../../core/sim/narrative/commands/types';
import { dialogIdFromExecution } from '../dialog-request';

const execution = (overrides: Partial<ChoiceExecution> & { commands: readonly NarrativeCommand[] }): ChoiceExecution => ({
  ok: true,
  event: null,
  cost: 0,
  rejections: [],
  ...overrides,
});

describe('dialog-request', () => {
  it('liest die Dialog-ID aus einem aufgeloesten TRIGGER_DIALOG', () => {
    const result = execution({ commands: [{ id: 'TRIGGER_DIALOG', dialogId: 'rita-am-tresen' }] });

    expect(dialogIdFromExecution(result)).toBe('rita-am-tresen');
  });

  it('oeffnet keinen Dialog ohne TRIGGER_DIALOG im Ergebnis', () => {
    const result = execution({ commands: [{ id: 'SET_FLAG', flag: 'x', delta: 1 }] });

    expect(dialogIdFromExecution(result)).toBeNull();
  });

  it('oeffnet keinen Dialog aus einer abgewiesenen Choice', () => {
    const result = execution({
      ok: false,
      commands: [{ id: 'TRIGGER_DIALOG', dialogId: 'rita-am-tresen' }],
      rejections: [{ commandId: 'OPEN_DIALOG', reason: 'INVALID_TARGET', detail: 'Dialog-ID ist unbekannt.' }],
    });

    expect(dialogIdFromExecution(result)).toBeNull();
  });

  it('ist gegenueber fehlenden Ergebnissen total', () => {
    expect(dialogIdFromExecution(null)).toBeNull();
    expect(dialogIdFromExecution(undefined)).toBeNull();
  });
});
