/**
 * @test-target: scripts/lib/ci-state.mjs
 * @error-code: ERR-4019
 *
 * Der CI-State ist genau ein Kommentar, ohne Zeitstempel, mit vollstaendiger
 * Lauf-, Kopf- und Basisbindung. Ein abgebrochener Lauf ist nur ueberholt,
 * wenn ein neuerer Lauf fuer denselben Kopf existiert.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCiState,
  isSupersededRun,
  latestCiState,
  parseCiState,
  readCiStateResult,
  serializeCiState,
} from '../../../../scripts/lib/ci-state.mjs';

const head = 'a'.repeat(40);
const base = 'b'.repeat(40);
const state = buildCiState({
  runId: '42750000000',
  runAttempt: 2,
  headSha: head,
  baseSha: base,
  state: 'SUCCESS',
  conclusion: 'success',
  failedGates: [],
  contract: { taskId: 'governance-phase3', phase: 'CI_PENDING', revision: 1 },
  nextAction: 'Merge auf exaktem Kopf.',
});

describe('ci-state', () => {
  it('schreibt und liest den exakten Kommentar ohne Zeitstempel', () => {
    const body = serializeCiState(state);
    expect(body).toContain('<!-- rbd:ci-state ');
    expect(parseCiState(body)).toEqual(state);
    expect(body).not.toContain('createdAt');
    expect(body).not.toContain('timestamp');
  });

  it('waehlt den neuesten Zustand anhand der monotonen Run-ID', () => {
    const older = buildCiState({ ...state, runId: '42749999999', state: 'FAILURE', conclusion: 'failure' });
    expect(latestCiState([{ body: serializeCiState(older) }, { body: serializeCiState(state) }])).toEqual(state);
    expect(latestCiState([{ body: 'normaler Kommentar' }])).toBeNull();
  });

  it('mappt Hold, Remote-CI und Superseded ohne falschen gruenen Merge-Beleg', () => {
    expect(readCiStateResult(state).conclusion).toBe('success');
    expect(readCiStateResult({ ...state, state: 'HOLD' })).toMatchObject({ complete: true, conclusion: 'success' });
    expect(readCiStateResult({ ...state, state: 'REMOTE_CI' })).toMatchObject({ complete: true, conclusion: null });
    expect(readCiStateResult({ ...state, state: 'SUPERSEDED' })).toMatchObject({ complete: false, conclusion: null });
  });

  it('erkennt nur einen neueren Lauf fuer denselben Kopf als Superseded', () => {
    const current = { id: 10, head_sha: head };
    expect(isSupersededRun(current, [{ id: 11, head_sha: head }])).toBe(true);
    expect(isSupersededRun(current, [{ id: 9, head_sha: head }])).toBe(false);
    expect(isSupersededRun(current, [{ id: 11, head_sha: 'c'.repeat(40) }])).toBe(false);
  });

  it('verweigert unvollstaendige Zustaende', () => {
    expect(() => buildCiState({ ...state, runId: 'kein-run' })).toThrow(/unvollstaendig/);
    expect(() => buildCiState({ ...state, headSha: 'abc' })).toThrow(/unvollstaendig/);
    expect(() => buildCiState({ ...state, state: 'DONE' })).toThrow(/unvollstaendig/);
  });
});
