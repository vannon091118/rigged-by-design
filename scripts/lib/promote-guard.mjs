/**
 * Promotion-Guard: Ein Merge darf nur den Commit treffen, den die CI geprueft
 * hat, und nur aus dem eigenen Repository. Der Branch-Name allein ist keine
 * Identitaet: zwischen CI-Lauf und Promote kann ein weiterer Push liegen.
 *
 * Seit Phase 1 zaehlt auch der gruene Pflichtstatus nur, wenn er aus genau
 * diesem `workflow_run` stammt und gegen dieselbe Basis lief. Ein alter
 * Push-Lauf auf demselben Kopf haette sonst einen gruenen
 * `Fail-Closed Gates`, den der aktuelle Lauf nie erzeugt hat.
 *
 * Die Funktionen sind rein und ohne `gh`/`git` testbar; `promote.mjs` liefert
 * die Angaben aus dem Workflow-Event und dem PR-Status.
 */

const FULL_SHA = /^[0-9a-f]{40}$/;
const RUN_ID = /^\d+$/;
const RUN_IN_URL = /\/actions\/runs\/(\d+)/;
const REQUIRED_CHECK = 'Fail-Closed Gates';

/**
 * PR-Suche fuer die Promotion. Der Zielbranch ist Teil der Identitaet: ein
 * PR mit passendem Head aber Ziel `integration` ist keine Freigabe fuer main.
 */
export function promotionPrListArgs(head, base = 'main') {
  return ['pr', 'list', '--base', base, '--head', head, '--state', 'open', '--json', 'number', '--jq', '.[0].number'];
}

/**
 * Ein manueller Dispatch ist kein CI-Ergebnis. Er darf hoechstens pruefen oder
 * den ausdruecklich angeforderten Notausgang waehlen, niemals einen Merge als
 * Erfolg ausgeben.
 */
export function manualDispatchAction(mode = '') {
  return mode === 'integrate' ? 'integrate' : 'inspect';
}

/**
 * Der gruene Pflichtstatus muss zu diesem Lauf und dieser Basis gehoeren.
 * Geprueft werden Name, Kopf, Abschluss und die im Check hinterlegte
 * Lauf-ID; `pull_requests[].base.sha` bindet ihn an die Basis.
 */
function ownGreenGate({ headSha = '', baseSha = '', ciRunId = '', checkRuns = null } = {}) {
  if (!FULL_SHA.test(String(baseSha ?? ''))) {
    return { ok: false, reason: `Basis '${baseSha || '(leer)'}' ist kein voller Commit-SHA` };
  }
  if (!RUN_ID.test(String(ciRunId ?? ''))) {
    return { ok: false, reason: `workflow_run-ID '${ciRunId || '(leer)'}' ist keine Lauf-ID` };
  }
  if (!Array.isArray(checkRuns)) {
    return { ok: false, reason: 'Check-Runs des geprueften Kopfes nicht lesbar' };
  }
  const green = checkRuns.filter(
    (run) =>
      run?.name === REQUIRED_CHECK &&
      run?.head_sha === headSha &&
      run?.status === 'completed' &&
      run?.conclusion === 'success',
  );
  if (green.length === 0) {
    return { ok: false, reason: `kein gruener ${REQUIRED_CHECK} auf ${headSha.slice(0, 7)}` };
  }
  const own = green.find((run) => {
    const runId = String(run?.details_url ?? '').match(RUN_IN_URL)?.[1] ?? '';
    if (runId !== String(ciRunId)) return false;
    const bases = (run?.pull_requests ?? []).map((entry) => entry?.base?.sha).filter(Boolean);
    return bases.includes(baseSha);
  });
  if (!own) {
    const seen = green.map((run) => String(run?.details_url ?? '').match(RUN_IN_URL)?.[1] ?? '?').join(', ');
    return {
      ok: false,
      reason: `gruener Check stammt nicht aus Lauf ${ciRunId} auf Basis ${baseSha.slice(0, 7)} (gefunden: ${seen})`,
    };
  }
  return { ok: true, reason: 'gruener Pflichtstatus aus diesem Lauf und dieser Basis' };
}

/**
 * @param {{
 *   event?: string,
 *   repo?: string,
 *   headRepo?: string,
 *   branch?: string,
 *   headSha?: string,
 *   baseSha?: string,
 *   ciRunId?: string,
 *   checkRuns?: readonly unknown[] | null,
 *   pr?: { state?: string, isCrossRepository?: boolean, headRefOid?: string, baseRefName?: string } | null,
 * }} input
 * @returns {{ ok: boolean, reason: string }}
 */
export function verifyPromotion({
  event = '',
  repo = '',
  headRepo = '',
  branch = '',
  headSha = '',
  baseSha = '',
  ciRunId = '',
  checkRuns = null,
  pr = null,
} = {}) {
  if (event !== 'pull_request') {
    return { ok: false, reason: `Lauf stammt aus '${event || 'manuell'}', nicht aus einem PR-Lauf` };
  }
  if (!repo || !headRepo || repo !== headRepo) {
    return { ok: false, reason: `PR-Kopf stammt nicht aus diesem Repository (${headRepo || 'unbekannt'})` };
  }
  if (!branch || branch === 'main' || branch === 'integration') {
    return { ok: false, reason: `Branch '${branch || '(leer)'}' ist kein Promotionskopf` };
  }
  if (!FULL_SHA.test(String(headSha ?? ''))) {
    return { ok: false, reason: `gepruefter Kopf '${headSha || '(leer)'}' ist kein voller Commit-SHA` };
  }
  if (!pr) return { ok: false, reason: 'PR-Status nicht lesbar' };
  if (pr.isCrossRepository) return { ok: false, reason: 'Fork-PR wird nicht promotet' };
  if (pr.state !== 'OPEN') return { ok: false, reason: `PR ist nicht offen (${pr.state || 'unbekannt'})` };
  if (pr.baseRefName !== 'main') return { ok: false, reason: `PR zielt auf '${pr.baseRefName || '(leer)'}', nicht auf main` };
  if (pr.headRefOid !== headSha) {
    return { ok: false, reason: `PR-Kopf ist ${String(pr.headRefOid || '(leer)').slice(0, 7)}, geprueft wurde ${headSha.slice(0, 7)}` };
  }
  const gate = ownGreenGate({ headSha, baseSha, ciRunId, checkRuns });
  if (!gate.ok) return gate;
  return { ok: true, reason: 'PR-Kopf ist der gepruefte Commit' };
}
