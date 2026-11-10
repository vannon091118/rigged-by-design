/**
 * @test-target: scripts/lib/promotion-state.mjs
 * @error-code: ERR-4019
 *
 * Ein Merge ist nur auf dem exakten PR-Lauf, mit passendem Plan-Artefakt und
 * ohne Hold erlaubt. Labels spiegeln den Vertrag; eine veraltete Basis fuehrt
 * zu update-branch, nicht zu einem Merge.
 */
import { describe, expect, it } from 'vitest';
import {
  contractHoldReason,
  labelDiff,
  promotionLabels,
  staleBase,
  taskTypeOf,
  validatePlanArtifact,
} from '../../../../scripts/lib/promotion-state.mjs';

const head = 'a'.repeat(40);
const base = 'b'.repeat(40);

const contract = {
  taskId: 'governance-phase3',
  phase: 'MERGE_PENDING',
  revision: 3,
  taskType: 'single',
  holdMerge: false,
  status: 'READY_FOR_MERGE',
};

describe('promotion-state', () => {
  it('akzeptiert nur ein Plan-Artefakt fuer diesen PR-Lauf', () => {
    const plan = { state: 'PR', head, base, runId: '42750000000' };
    expect(validatePlanArtifact(plan, { headSha: head, baseSha: base }).ok).toBe(true);
    expect(validatePlanArtifact({ ...plan, head: 'c'.repeat(40) }, { headSha: head, baseSha: base }).ok).toBe(false);
    expect(validatePlanArtifact({ ...plan, base: 'd'.repeat(40) }, { headSha: head, baseSha: base }).ok).toBe(false);
    expect(validatePlanArtifact({ ...plan, state: 'NOOP' }, { headSha: head, baseSha: base }).ok).toBe(false);
    expect(validatePlanArtifact(null, { headSha: head, baseSha: base }).ok).toBe(false);
  });

  it('haelt holdMerge, status und nicht merge-bereite Phasen an', () => {
    expect(contractHoldReason(contract)).toBeNull();
    expect(contractHoldReason({ ...contract, holdMerge: true })).toBe('holdMerge=true');
    expect(contractHoldReason({ ...contract, status: 'HOLD' })).toBe('status=HOLD');
    expect(contractHoldReason({ ...contract, phase: 'IMPLEMENTING' })).toBe('phase=IMPLEMENTING');
    expect(contractHoldReason(null)).toBeNull();
  });

  it('spiegelt Task-Typ und Hold in Labels und entfernt alte task-Labels', () => {
    expect(taskTypeOf(contract)).toBe('single');
    expect(taskTypeOf({ ...contract, phase: 'AFTERCARE' })).toBe('aftercare');
    expect(promotionLabels(contract, false)).toEqual(['task:ready', 'task:single']);
    expect(promotionLabels(contract, true)).toEqual(['task:hold', 'task:single']);
    expect(labelDiff(['task:ready', 'task:single', 'bug'], ['task:hold', 'task:single'])).toEqual({
      add: ['task:hold'],
      remove: ['task:ready'],
    });
  });

  it('erkennt eine veraltete Basis', () => {
    expect(staleBase(base, base)).toBeNull();
    expect(staleBase(base, 'e'.repeat(40))).toContain('ist nicht mehr main');
  });
});
