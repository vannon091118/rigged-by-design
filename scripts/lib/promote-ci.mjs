/**
 * CI-State und Vertrags-Labels: genau ein marker-tragender Kommentar, Labels
 * spiegeln den Vertrag, ein Hold entfernt `task:ready`.
 */
import { buildCiState, parseCiState, serializeCiState } from './ci-state.mjs';
import { labelDiff, promotionLabels } from './promotion-state.mjs';

const RUN_ID = /^\d+$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

export function createPromoteCi({
  gh, hasToken, ciRunId, headSha, baseSha, runAttempt, repo, prInfo, warn,
}) {
  function listAll(path) {
    const raw = gh(['api', '--paginate', '--slurp', path]);
    if (!raw) return null;
    try {
      const pages = JSON.parse(raw);
      return Array.isArray(pages) ? pages.flat() : null;
    } catch {
      return null;
    }
  }

  function contractView(contract) {
    if (!contract) return null;
    return {
      taskId: contract.taskId,
      phase: contract.phase,
      revision: contract.revision,
      taskType: contract.taskType ?? 'single',
      holdMerge: contract.holdMerge === true,
      status: contract.status ?? 'READY_FOR_MERGE',
      nextAction: contract.nextAction ?? '',
    };
  }

  function failedGatesOfRun() {
    if (!RUN_ID.test(String(ciRunId))) return [];
    const raw = gh(['api', `repos/${repo}/actions/runs/${ciRunId}/jobs?per_page=100`]);
    if (!raw) return [];
    try {
      const jobs = JSON.parse(raw)?.jobs ?? [];
      return jobs
        .filter((job) => ['failure', 'cancelled', 'timed_out'].includes(job.conclusion))
        .map((job) => job.name)
        .filter(Boolean)
        .sort();
    } catch {
      return [];
    }
  }

  function writeCiState({ number, state, conclusion: result, contract = null, nextAction = '' }) {
    if (!number || !hasToken || !RUN_ID.test(String(ciRunId)) || !FULL_SHA.test(headSha) || !FULL_SHA.test(baseSha)) return;
    let body;
    try {
      body = serializeCiState(buildCiState({
        runId: ciRunId,
        runAttempt,
        headSha,
        baseSha,
        state,
        conclusion: result,
        failedGates: failedGatesOfRun(),
        contract: contractView(contract),
        nextAction,
      }));
    } catch (error) {
      warn(`CI-State nicht gebaut: ${String(error?.message ?? error)}`);
      return;
    }
    const comments = listAll(`repos/${repo}/issues/${number}/comments?per_page=100`);
    if (!comments) {
      warn(`PR #${number}: Kommentare nicht lesbar; CI-State nicht geschrieben`);
      return;
    }
    const marked = comments.filter((comment) => parseCiState(comment.body));
    const newest = marked.at(-1);
    const written = newest
      ? gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${newest.id}`, '-f', `body=${body}`])
      : gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`]);
    if (written === null) warn(`PR #${number}: CI-State nicht geschrieben`);
    for (const older of marked.slice(0, -1)) {
      gh(['api', '--method', 'DELETE', `repos/${repo}/issues/comments/${older.id}`]);
    }
  }

  function syncTaskLabels(number, contract, hold = false) {
    if (!number || !contract) return;
    const info = prInfo(number);
    const current = (info?.labels ?? []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean);
    const desired = promotionLabels(contract, hold);
    const diff = labelDiff(current, desired);
    for (const label of desired) {
      gh(['label', 'create', label, '--color', '1d76db', '--description', 'Task-Vertrag', '--force']);
    }
    for (const label of diff.remove) gh(['pr', 'edit', String(number), '--remove-label', label]);
    for (const label of diff.add) gh(['pr', 'edit', String(number), '--add-label', label]);
  }

  function holdPromotion(number, contract, reason) {
    writeCiState({
      number,
      state: 'HOLD',
      conclusion: '',
      contract,
      nextAction: `Hold: ${reason}`,
    });
    syncTaskLabels(number, contract, true);
    warn(`PR #${number}: Hold - ${reason}; kein Merge`);
    return false;
  }

  return { listAll, writeCiState, syncTaskLabels, holdPromotion, failedGatesOfRun, contractView };
}
