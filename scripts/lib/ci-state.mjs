/**
 * CI-State: genau ein maschinenlesbarer Kommentar am PR.
 *
 * Der Kommentar ist die Zustandsquelle fuer `pretask` und `promote`. Er wird
 * von `promote` bei jedem abgeschlossenen PR-Lauf geschrieben, nie mit einem
 * Zeitstempel versehen und bei einem neuen Lauf am selben Kommentar ersetzt.
 * Damit gibt es eine Wahrheit statt einer Sammlung von Statusmeldungen.
 */
const FULL_SHA = /^[0-9a-f]{40}$/;
const RUN_ID = /^\d+$/;

export const CI_STATE_MARKER = 'rbd:ci-state';
export const CI_STATE_PATTERN = /<!--\s*rbd:ci-state\s+(\{[\s\S]*?\})\s*-->/;
export const CI_STATE_STATES = Object.freeze(['SUCCESS', 'FAILURE', 'REMOTE_CI', 'SUPERSEDED', 'HOLD']);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Ein Zustand ist nur gueltig, wenn alle Pflichtfelder vollstaendig sind. */
export function isCiState(value) {
  if (!isObject(value)) return false;
  if (!RUN_ID.test(String(value.runId ?? ''))) return false;
  if (!Number.isInteger(value.runAttempt) || value.runAttempt < 1) return false;
  if (!FULL_SHA.test(String(value.headSha ?? ''))) return false;
  if (!FULL_SHA.test(String(value.baseSha ?? ''))) return false;
  if (!CI_STATE_STATES.includes(String(value.state ?? ''))) return false;
  if (typeof value.conclusion !== 'string') return false;
  if (!Array.isArray(value.failedGates) || value.failedGates.some((gate) => typeof gate !== 'string')) return false;
  if (value.contract !== null && !isObject(value.contract)) return false;
  if (typeof value.nextAction !== 'string') return false;
  return true;
}

/** Normalisiert die Eingabe; ein ungueltiger Zustand wird nie geschrieben. */
export function buildCiState({
  runId,
  runAttempt = 1,
  headSha,
  baseSha,
  state,
  conclusion = '',
  failedGates = [],
  contract = null,
  nextAction = '',
} = {}) {
  const value = {
    runId: String(runId ?? ''),
    runAttempt: Number(runAttempt),
    headSha: String(headSha ?? ''),
    baseSha: String(baseSha ?? ''),
    state: String(state ?? '').toUpperCase(),
    conclusion: String(conclusion ?? ''),
    failedGates: [...new Set((failedGates ?? []).map((gate) => String(gate)).filter(Boolean))].sort(),
    contract: contract ?? null,
    nextAction: String(nextAction ?? ''),
  };
  if (!isCiState(value)) throw new Error('CI-State ist unvollstaendig oder ungueltig');
  return value;
}

/** Der exakte Kommentar; JSON ist kompakt und enthaelt keinen Zeitstempel. */
export function serializeCiState(state) {
  if (!isCiState(state)) throw new Error('CI-State ist unvollstaendig oder ungueltig');
  return `<!-- ${CI_STATE_MARKER} ${JSON.stringify(state)} -->`;
}

/** Liest den Zustand aus einem Kommentar; fremde Kommentare ergeben `null`. */
export function parseCiState(text) {
  const match = CI_STATE_PATTERN.exec(String(text ?? ''));
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return isCiState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Der neueste Zustand aus einer Kommentarliste. Die Run-ID ist monoton und
 * bleibt auch dann eindeutig, wenn GitHub Kommentare anders sortiert liefert.
 */
export function latestCiState(comments = []) {
  const found = [];
  for (const comment of Array.isArray(comments) ? comments : []) {
    const state = parseCiState(comment?.body ?? comment);
    if (state) found.push(state);
  }
  found.sort((left, right) => Number(left.runId) - Number(right.runId));
  return found.at(-1) ?? null;
}

/** Wandelt den Kommentar in die Form, die `pretask` und `deriveTaskState` lesen. */
export function readCiStateResult(state) {
  if (!state) return { known: false, complete: false, conclusion: null, state: null };
  const base = { known: true, state: state.state, nextAction: state.nextAction, comment: state };
  if (state.state === 'SUCCESS') return { ...base, complete: true, conclusion: 'success' };
  if (state.state === 'FAILURE') return { ...base, complete: true, conclusion: 'failure' };
  if (state.state === 'HOLD') return { ...base, complete: true, conclusion: 'success' };
  if (state.state === 'REMOTE_CI') return { ...base, complete: true, conclusion: null };
  return { ...base, complete: false, conclusion: null };
}

/** Ein abgebrochener Lauf ist nur dann ueberholt, wenn ein neuerer Lauf existiert. */
export function isSupersededRun(current = {}, runs = []) {
  const currentId = Number(current.id ?? current.runId ?? 0);
  if (!currentId) return false;
  return (Array.isArray(runs) ? runs : []).some((run) => {
    const id = Number(run?.id ?? run?.databaseId ?? 0);
    if (!id || id <= currentId) return false;
    if (current.head_sha && run?.head_sha && current.head_sha !== run.head_sha) return false;
    return true;
  });
}
