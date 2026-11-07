/**
 * Merge-Nachweis fuer Lane-Claims.
 *
 * Ein Basis-SHA ist **kein** Merge-Beweis: er liegt per Definition auf `main`.
 * Ein Claim darf erst `merged` werden, wenn ein gemergter Pull Request fuer
 * genau diesen Branch existiert, der Branch-Kopf auf `main` liegt oder der
 * Lane-Baum mit einem Commit auf `main` identisch ist. Der dritte Fall ist der
 * Normalfall eines Squash-Merges: der Branch ist danach geloescht, sein Inhalt
 * steht als ein Commit auf `main`. Fehlt jeder Nachweis, bleibt der Claim
 * unveraendert - fail-closed statt geraten.
 */
import { execFileSync } from 'node:child_process';

/** Ein Git-Aufruf; Tests setzen dieselbe Signatur mit eigener Implementierung. */
const defaultGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Erste aufloesbare Ref eines Branches: lokal vor Remote-Tracking. */
function localHead(branch, git) {
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
    try {
      const sha = git(['rev-parse', '--verify', '--quiet', ref]);
      if (sha) return sha;
    } catch {
      // Ref fehlt: naechste probieren. Kein Beleg, keine Behauptung.
    }
  }
  return null;
}

function isAncestor(sha, baseRef, git) {
  try {
    git(['merge-base', '--is-ancestor', sha, baseRef]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ein Commit auf `main` mit demselben Baum wie der Lane-Kopf. Ein Aufruf fuer
 * die ganze Historie; Baumgleichheit heisst: der Inhalt der Lane steht auf
 * `main`, auch wenn der Branch selbst laengst geloescht ist.
 */
function treeMatch(sha, baseRef, git) {
  let tree;
  try {
    tree = git(['rev-parse', `${sha}^{tree}`]);
  } catch {
    return null;
  }
  if (!tree) return null;
  let listing;
  try {
    listing = git(['log', '--format=%H %T', baseRef]);
  } catch {
    return null;
  }
  for (const line of listing.split('\n')) {
    const [commit, commitTree] = line.split(' ');
    if (commit && commitTree === tree) return commit;
  }
  return null;
}

/**
 * Lokale Evidenz zu einem Branch: Kopf, Kopf auf `main`, baumgleicher Commit
 * auf `main`. Braucht weder `gh` noch Netz, nur die lokale Historie.
 */
export function localMergeEvidence({ branch, baseRef = 'origin/main', git = defaultGit } = {}) {
  const headSha = localHead(branch, git);
  if (!headSha) return { headSha: null, headOnMain: false, treeOnMain: null };
  // Ein frisch angelegter Branch steht auf der Basis: kein eigener Commit,
  // kein Merge. Ohne diese Grenze gaelte jede neue Lane sofort als gemergt,
  // weil Kopf und Basis identisch sind.
  let baseTip = null;
  try {
    baseTip = git(['rev-parse', baseRef]);
  } catch {
    // Ohne Basis bleibt die Gleichheit ungeprueft; der Baum-Beleg entscheidet.
  }
  if (baseTip && headSha === baseTip) return { headSha, headOnMain: false, treeOnMain: null };
  return {
    headSha,
    headOnMain: isAncestor(headSha, baseRef, git),
    treeOnMain: treeMatch(headSha, baseRef, git),
  };
}

/**
 * Entscheidet den Claim-Status aus Evidenz. `baseSha` kommt absichtlich nicht
 * vor; diese Signatur ist die Grenze, die den alten Fehler unmoeglich macht.
 */
export function decideClaim({
  branchExists = false,
  branchHeadOnMain = false,
  branchTreeOnMain = null,
  mergedPr = null,
} = {}) {
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
  if (branchExists && branchTreeOnMain) {
    return {
      status: 'merged',
      evidence: 'branch-tree-on-main',
      why: `Lane-Baum liegt auf main (${String(branchTreeOnMain).slice(0, 7)})`,
    };
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
