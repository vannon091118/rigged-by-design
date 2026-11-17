/**
 * Optionale Fernsicht auf CI und PR. Kein Merge-Gate: ohne `gh` und ohne
 * Token bleibt der Zustand `unknown` und blockiert nie.
 */
import { execFileSync } from 'node:child_process';
import { ROOT } from './report.mjs';
import { rest } from './github-rest.mjs';
import { latestCiState, readCiStateResult } from './ci-state.mjs';

/** Liest den optionalen PR-Check-Status; er ist kein Merge-Gate. */
export function readCiState({ branch, ghBin = process.env.RBD_GH_BIN || 'gh', root = ROOT } = {}) {
  if (!branch) return { known: false, complete: false, conclusion: null, name: 'Fail-Closed Gates' };
  try {
    const output = execFileSync(
      ghBin,
      ['pr', 'view', branch, '--json', 'number,headRefOid,comments,statusCheckRollup'],
      { cwd: root, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return ciStateFrom(JSON.parse(output));
  } catch {
    const fallback = rest('ci-for-branch', { branch });
    if (fallback.ok) return ciStateFrom(fallback.data);
    return { known: false, complete: false, conclusion: null, name: 'Fail-Closed Gates' };
  }
}

/** CI-Zustand aus gh- oder REST-Daten; der Kommentar schlaegt den Rollup. */
function ciStateFrom(data) {
  const comment = latestCiState(data?.comments ?? []);
  if (comment && comment.headSha === data?.headRefOid) {
    return {
      ...readCiStateResult(comment),
      name: comment.state === 'HOLD' ? 'Fail-Closed Gates' : 'rbd:ci-state',
      url: null,
      prNumber: data?.number ?? null,
    };
  }
  const rollup = data?.statusCheckRollup ?? [];
  const required = rollup.find((check) => check.name === 'Fail-Closed Gates' || check.context === 'Fail-Closed Gates') ?? null;
  if (!required) return { known: true, complete: false, conclusion: null, name: 'Fail-Closed Gates' };
  const status = String(required.status ?? required.state ?? '').toLowerCase();
  const conclusion = String(required.conclusion ?? '').toLowerCase() || null;
  return {
    known: true,
    complete: status === 'completed' || status === 'success' || status === 'failure',
    conclusion: conclusion ?? (status === 'success' ? 'success' : status === 'failure' ? 'failure' : null),
    name: 'Fail-Closed Gates',
    url: required.detailsUrl ?? required.targetUrl ?? null,
    prNumber: data?.number ?? null,
  };
}

/** Ein PR-Datensatz aus gh- oder REST-Form; beide liefern dieselben Felder. */
function pullStateFrom(data) {
  if (!data || data.number === undefined || data.number === null) return null;
  return {
    known: true,
    number: data.number ?? null,
    url: data.url ?? null,
    state: String(data.state ?? '').toLowerCase() || 'open',
    draft: Boolean(data.isDraft),
    headSha: data.headRefOid ?? null,
    base: data.baseRefName ?? null,
    merged: Boolean(data.mergedAt) || String(data.state).toUpperCase() === 'MERGED',
  };
}

/** PR-Zustand aus GitHub; zwei Lesepfade, ein Ergebnis. */
export function readPullRequestState({ branch, ghBin = process.env.RBD_GH_BIN || 'gh', root = ROOT } = {}) {
  if (!branch) return { known: false, error: 'kein Branch' };
  try {
    const output = execFileSync(
      ghBin,
      ['pr', 'view', branch, '--json', 'number,url,state,isDraft,headRefOid,baseRefName,mergedAt'],
      { cwd: root, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const state = pullStateFrom(JSON.parse(output));
    if (state) return state;
  } catch {
    // Weiter mit dem Token-Pfad.
  }
  const fallback = rest('pull-for-branch', { branch });
  const state = fallback.ok ? pullStateFrom(fallback.data) : null;
  if (state) return state;
  return {
    known: false,
    error: `PR-Zustand nicht lesbar (gh nicht angemeldet und ${fallback.error ?? 'kein Token'})`,
  };
}
