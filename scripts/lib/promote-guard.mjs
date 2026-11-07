/**
 * Promotion-Guard: Ein Merge darf nur den Commit treffen, den die CI geprueft
 * hat, und nur aus dem eigenen Repository. Der Branch-Name allein ist keine
 * Identitaet: zwischen CI-Lauf und Promote kann ein weiterer Push liegen.
 *
 * Die Funktion ist rein und ohne `gh`/`git` testbar; `promote.mjs` liefert die
 * Angaben aus dem Workflow-Event und dem PR-Status.
 */

const FULL_SHA = /^[0-9a-f]{40}$/;

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
export function verifyPromotion({ event = '', repo = '', headRepo = '', branch = '', headSha = '', pr = null } = {}) {
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
