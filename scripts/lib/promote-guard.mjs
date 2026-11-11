/**
 * Promotion-Guard: Ein Merge darf nur den Commit treffen, den der PR als Kopf
 * traegt, und nur aus dem eigenen Repository. Der Branch-Name allein ist keine
 * Identitaet: zwischen Pruefung und Merge kann ein weiterer Push liegen.
 *
 * Der PR-Check ist optional und wird hier nicht vorausgesetzt; er ist ein
 * Hinweis, keine Merge-Bedingung. `promote.mjs` bleibt ein manueller
 * Status-/Notausgang.
 *
 * Die Funktionen sind rein und ohne `gh`/`git` testbar; `promote.mjs` liefert
 * die Angaben aus dem Workflow-Event und dem PR-Status.
 */

const FULL_SHA = /^[0-9a-f]{40}$/;


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
 * @param {{
 *   event?: string,
 *   repo?: string,
 *   headRepo?: string,
 *   branch?: string,
 *   headSha?: string,
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
  return { ok: true, reason: 'PR-Kopf ist der gepruefte Commit' };
}
