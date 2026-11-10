/**
 * @test-target: scripts/lib/task-contract.mjs
 * @error-code: ERR-4019
 *
 * Ein gemergter PR ist Nachsorge, nicht Abschluss. Die Phase muss AFTERCARE
 * sein, damit die Nachsorge wirklich durchlaufen wird; DONE ohne Merge bleibt
 * DONE. Der Test ruft die echte Funktion, nicht eine Kopie der Regel.
 */
import { describe, expect, it } from 'vitest';
import { deriveTaskState } from '../../../../scripts/lib/task-contract.mjs';

const contract = (phase: string) => ({ phase, findings: [], nextAction: null });

describe('deriveTaskState', () => {
  it('setzt einen gemergten PR auf AFTERCARE statt DONE', () => {
    const state = deriveTaskState({ contract: contract('MERGE_PENDING'), pr: { merged: true } });
    expect(state.status).toBe('AFTERCARE');
    expect(state.phase).toBe('AFTERCARE');
  });

  it('laesst DONE ohne gemergten PR auf DONE', () => {
    const state = deriveTaskState({ contract: contract('DONE'), pr: { merged: false } });
    expect(state.status).toBe('AFTERCARE');
    expect(state.phase).toBe('DONE');
  });

  it('korrigiert auch einen DONE-Vertrag, wenn der PR gemergt ist', () => {
    const state = deriveTaskState({ contract: contract('DONE'), pr: { merged: true } });
    expect(state.phase).toBe('AFTERCARE');
  });
});
