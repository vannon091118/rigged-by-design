/**
 * Merge-Nachweis fuer Lane-Claims.
 *
 * Ein Basis-SHA ist **kein** Merge-Beweis: er liegt per Definition auf `main`.
 * Ein Claim darf erst `merged` werden, wenn ein gemergter Pull Request fuer
 * genau diesen Branch existiert, der Branch-Kopf auf `main` liegt oder der
 * Lane-Baum mit einem Commit auf `main` identisch ist. Der dritte Fall ist der
 * Normalfall eines Squash-Merges: der Branch ist danach geloescht, sein Inhalt
 * steht als ein Commit auf `main`. Ein gemergter PR belegt den Claim auch bei
 * geloeschtem Branch, wenn sein Merge-Commit auf `main` liegt; ein aktiver
 * Branch mit eigenem, nicht gemergtem Kopf bleibt fail-closed.
 */
import { execFileSync } from 'node:child_process';

/** Ein Git-Aufruf; Tests setzen dieselbe Signatur mit eigener Implementierung. */
const defaultGit = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Ein `gh`-Aufruf; Tests ersetzen ihn durch eine Tabelle. */
const FULL_SHA = /^[0-9a-f]{40}$/;

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
 * Liegt der Commit auf `main`? Ein Merge-Commit ist dort selbst dann, wenn er
 * exakt der Basis-Kopf ist. Fuer Squash-Merges genuegt ein baumgleicher Commit.
 */
export function commitOnMain({ sha, baseRef = 'origin/main', git = defaultGit } = {}) {
  if (!FULL_SHA.test(String(sha ?? ''))) return false;
  try {
    if (git(['rev-parse', baseRef]) === sha) return true;
  } catch {
    // Ohne Basis entscheidet der Vorfahr- oder Baum-Beleg.
  }
  return isAncestor(sha, baseRef, git) || Boolean(treeMatch(sha, baseRef, git));
}

/**
 * Lokale Evidenz zu einem Branch: Kopf, Kopf auf `main`, baumgleicher Commit
 * auf `main`. Braucht weder `gh` noch Netz, nur die lokale Historie.
 */
export function localMergeEvidence({ branch, baseRef = 'origin/main', git = defaultGit } = {}) {
  const headSha = localHead(branch, git);
  if (!headSha) return { headSha: null, headOnMain: false, treeOnMain: null, atBase: false };
  // Ein frisch angelegter Branch steht auf der Basis: kein eigener Commit,
  // kein Merge. Ohne diese Grenze gaelte jede neue Lane sofort als gemergt,
  // weil Kopf und Basis identisch sind.
  let baseTip = null;
  try {
    baseTip = git(['rev-parse', baseRef]);
  } catch {
    // Ohne Basis bleibt die Gleichheit ungeprueft; der Baum-Beleg entscheidet.
  }
  if (baseTip && headSha === baseTip) return { headSha, headOnMain: false, treeOnMain: null, atBase: true };
  return {
    headSha,
    headOnMain: isAncestor(headSha, baseRef, git),
    treeOnMain: treeMatch(headSha, baseRef, git),
    atBase: false,
  };
}

/**
 * Entscheidet den Claim-Status aus Evidenz. `baseSha` kommt absichtlich nicht
 * vor; diese Signatur ist die Grenze, die den alten Fehler unmoeglich macht.
 */
export function decideClaim({
  branchExists = false,
  branchAtBase = false,
  branchHeadOnMain = false,
  branchTreeOnMain = null,
  headSha = null,
  mergedPr = null,
  mergedOnMain = false,
} = {}) {
  // Der PR-Beleg braucht die Identitaet des Heads, nicht nur den Branch-Namen:
  // Ein wiederverwendeter Branch darf nicht den Merge eines alten PRs erben.
  // Fehlt der lokale Kopf (Branch bereits geloescht), bleibt es fail-closed.
  if (
    mergedPr?.number &&
    FULL_SHA.test(String(headSha ?? '')) &&
    mergedPr.headRefOid === headSha
  ) {
    const sha = mergedPr.mergeCommit ?? mergedPr.mergeCommitSha ?? '';
    return {
      status: 'merged',
      evidence: 'merged-pr',
      why: `PR #${mergedPr.number} ist gemergt${sha ? ` (${String(sha).slice(0, 7)})` : ''}`,
    };
  }
  // Ein frischer Branch steht auf der Basis, obwohl sein Kopf damit auf main
  // liegt. Das ist keine eigene Arbeit und darf den Claim nicht als gemergt
  // schliessen; der Beleg braucht einen PR-Kopf oder einen Branch ohne
  // eigenen Kopf. Diese Pruefung steht vor dem breiten Head-on-main-Fall.
  if (branchExists && branchAtBase) {
    return { status: null, evidence: 'none', why: 'Branch steht auf der Basis; keine eigene Arbeit' };
  }
  // Ein geloeschter Branch oder ein auf die Basis zurueckgesetzter Branch hat
  // keinen eigenen Kopf mehr. Der gemergte PR plus Merge-Commit auf `main` ist
  // dann der Beleg; ein aktiver Branch mit eigenem Kopf faellt nicht hierher.
  if (mergedPr?.number && mergedOnMain && (!branchExists || branchAtBase)) {
    const sha = mergedPr.mergeCommit ?? mergedPr.mergeCommitSha ?? '';
    return {
      status: 'merged',
      evidence: 'merged-pr',
      why: `PR #${mergedPr.number} ist gemergt${sha ? ` (${String(sha).slice(0, 7)})` : ''}; Branch ${branchExists ? 'steht auf der Basis' : 'ist geloescht'}`,
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
