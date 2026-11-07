/**
 * Merge-Nachweis fuer Lane-Claims.
 *
 * Ein Basis-SHA ist **kein** Merge-Beweis: er liegt per Definition auf `main`.
 * Ein Claim darf erst `merged` werden, wenn der Branch-Kopf nachweislich auf
 * `main` liegt oder ein gemergter Pull Request fuer genau diesen Branch
 * existiert. Fehlt der Nachweis, bleibt der Claim unveraendert und der Befund
 * wird nur gemeldet - fail-closed statt geraten.
 */
import { execFileSync } from 'node:child_process';

/**
 * Entscheidet den Claim-Status aus Evidenz. `baseSha` kommt absichtlich nicht
 * vor; diese Signatur ist die Grenze, die den alten Fehler unmoeglich macht.
 */
export function decideClaim({ branchExists = false, branchHeadOnMain = false, mergedPr = null } = {}) {
  if (mergedPr && mergedPr.number) {
    const sha = mergedPr.mergeCommit ?? mergedPr.mergeCommitSha ?? '';
    return {
      status: 'merged',
      evidence: 'merged-pr',
      why: `PR #${mergedPr.number} ist gemergt${sha ? ` (${String(sha).slice(0, 7)})` : ''}`,
    };
  }
  if (branchExists && branchHeadOnMain) {
    return { status: 'merged', evidence: 'branch-head-on-main', why: 'Branch-Kopf liegt auf main' };
  }
  if (branchExists) {
    return { status: null, evidence: 'none', why: 'Branch existiert; die Arbeit laeuft' };
  }
  return { status: null, evidence: 'none', why: 'Branch nicht am Remote, kein Merge-Beleg' };
}

/**
 * Gemergte Pull Requests je Head-Branch. Ohne `gh` oder ohne Token `null`:
 * dann gibt es keinen Nachweis, und niemand behauptet einen.
 */
export function mergedPullRequestIndex() {
  try {
    const output = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'merged', '--limit', '200', '--json', 'headRefName,number,mergeCommit,url'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const index = new Map();
    for (const entry of JSON.parse(output)) {
      if (!entry?.headRefName || !entry?.number) continue;
      index.set(entry.headRefName, {
        number: entry.number,
        mergeCommit: entry.mergeCommit?.oid ?? null,
        url: entry.url ?? null,
      });
    }
    return index;
  } catch {
    return null;
  }
}
