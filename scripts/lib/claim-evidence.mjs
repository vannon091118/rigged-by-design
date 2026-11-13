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
const defaultGh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

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

/**
 * Kollisionen gegen belegte Merges filtern: eine Lane, deren Arbeit
 * nachweislich auf `main` steht, ist keine Sperre mehr, sondern ein
 * veralteter Eintrag. Dieselbe Entscheidung wie `decideClaim`, als Liste
 * fuer Pretask und Lane-Claims-Gate. `onMerged` meldet jede
 * herausgefilterte Kollision; ohne jeden Nachweis bleibt es fail-closed
 * bei der Kollision.
 */
export function filterMergedCollisions({
  collisions = [],
  claims = [],
  baseRef = 'origin/main',
  git = defaultGit,
  gh = defaultGh,
  onMerged = null,
  prIndex,
  prGroups,
} = {}) {
  const mergedIndex = prIndex === undefined ? mergedPullRequestIndex({ gh, baseRef: 'main' }) : prIndex;
  // Mehrdeutige Branch-Namen (ein Name, mehrere gemergte PRs) bleiben fuer die
  // Identitaet unbrauchbar, taugen aber als Merge-Beleg: Wenn jede Fassung des
  // Branches auf `main` liegt, ist die Arbeit gemergt, egal welche davon der
  // Claim meinte. Genau dieser Fall blockierte Lane-Pfade dauerhaft.
  const mergedGroups = prGroups === undefined && prIndex === undefined
    ? mergedPullRequestGroups({ gh, baseRef: 'main' })
    : prGroups ?? null;
  let baseTip = null;
  try {
    baseTip = git(['rev-parse', baseRef]);
  } catch {
    baseTip = null;
  }
  const remoteHead = (branch) => {
    try {
      const out = git(['ls-remote', '--heads', 'origin', branch]);
      return { known: true, sha: String(out ?? '').split(/\s+/)[0] || null };
    } catch {
      return { known: false, sha: null };
    }
  };
  return collisions.filter((collision) => {
    const other = claims.find((entry) => entry.id === collision.lane);
    if (!other) return true;
    const pr = mergedIndex?.get(other.branch) ?? null;
    const group = mergedGroups?.get(other.branch) ?? null;
    const local = localMergeEvidence({ branch: other.branch, baseRef, git });
    const remote = local.headSha ? { known: true, sha: null } : remoteHead(other.branch);
    const branchHead = local.headSha ?? remote.sha;
    const branchExists = Boolean(branchHead);
    const branchAtBase =
      local.atBase ||
      Boolean(other.baseSha && branchHead === other.baseSha) ||
      Boolean(remote.sha && baseTip && remote.sha === baseTip);
    // Ein fehlender Branch ist nur dann belegt, wenn `ls-remote` erfolgreich war.
    // Ein Netzfehler bleibt fail-closed und laesst die Kollision stehen.
    const absenceKnown = !branchExists && remote.known;
    const allGroupMergesOnMain = Boolean(
      !pr && group && group.length > 1 && !branchExists && absenceKnown &&
        group.every((entry) => commitOnMain({ sha: entry.mergeCommit ?? entry.headRefOid, baseRef, git })),
    );
    const mergedOnMain = allGroupMergesOnMain || Boolean(
      pr &&
        (branchExists ? branchAtBase : absenceKnown) &&
        commitOnMain({ sha: pr.mergeCommit ?? pr.headRefOid, baseRef, git }),
    );
    const evidence = decideClaim({
      branchExists,
      branchAtBase,
      branchHeadOnMain: local.headOnMain,
      branchTreeOnMain: local.treeOnMain,
      headSha: branchHead,
      mergedPr: pr ?? (allGroupMergesOnMain ? group?.[0] ?? null : null),
      mergedOnMain,
    });
    if (evidence.status === 'merged') {
      if (typeof onMerged === 'function') onMerged(collision, evidence);
      return false;
    }
    return true;
  });
}

/**
 * Gemergte Pull Requests je Head-Branch. Ohne `gh` oder ohne Token `null`:
 * dann gibt es keinen Nachweis, und niemand behauptet einen.
 */
export function mergedPullRequestGroups({ gh = defaultGh, baseRef = 'main' } = {}) {
  try {
    const output = gh([
      'pr',
      'list',
      '--state',
      'merged',
      '--limit',
      '200',
      '--json',
      'baseRefName,headRefName,headRefOid,isCrossRepository,number,mergeCommit,url',
    ]);
    const groups = new Map();
    for (const entry of JSON.parse(output)) {
      if (!entry?.headRefName || !entry?.number) continue;
      // Nur ein Merge nach `main` aus diesem Repository ist ein Claim-Beleg.
      if (entry.baseRefName !== baseRef) continue;
      if (entry.isCrossRepository !== false) continue;
      if (!FULL_SHA.test(String(entry.headRefOid ?? ''))) continue;
      const list = groups.get(entry.headRefName) ?? [];
      list.push({
        number: entry.number,
        headRefOid: entry.headRefOid,
        mergeCommit: entry.mergeCommit?.oid ?? null,
        url: entry.url ?? null,
      });
      groups.set(entry.headRefName, list);
    }
    return groups;
  } catch {
    return null;
  }
}

/**
 * Gemergte Pull Requests je Head-Branch. Ein Branch-Name mit mehreren
 * gemergten PRs ist keine Identitaet und wird hier verworfen; wer nur wissen
 * will, ob die Arbeit gemergt ist, liest `mergedPullRequestGroups`.
 */
export function mergedPullRequestIndex({ gh = defaultGh, baseRef = 'main' } = {}) {
  const groups = mergedPullRequestGroups({ gh, baseRef });
  if (groups === null) return null;
  const index = new Map();
  for (const [branch, list] of groups) {
    if (list.length === 1) index.set(branch, list[0]);
  }
  return index;
}

/**
 * Alle Branch-Koepfe am Remote in einem Aufruf. `null` heisst: Remote nicht
 * erreichbar. Eine leere Map ist ein bekannter Zustand ohne Branch und damit
 * ein Beleg fuer "Branch ist geloescht".
 */
export function remoteHeads({ git = defaultGit } = {}) {
  try {
    const output = git(['ls-remote', '--heads', 'origin']);
    const heads = new Map();
    for (const line of String(output ?? '').split(/\r?\n/)) {
      const [sha = '', ref = ''] = line.trim().split(/\s+/);
      if (!sha || !ref.startsWith('refs/heads/')) continue;
      heads.set(ref.slice('refs/heads/'.length), sha);
    }
    return heads;
  } catch {
    return null;
  }
}

/** Die Evidenz-Namen der Lifecycle-Sprache; die Entscheidung bleibt in `decideClaim`. */
const LIFECYCLE_EVIDENCE = Object.freeze({
  'merged-pr': 'merged-pr',
  'branch-head-on-main': 'head-on-main',
  'branch-tree-on-main': 'tree-on-main',
});

/**
 * Lesender Reconcile: welche offenen Claims sind belegbar gemergt? Schreibt
 * nichts; `reconcile-claims --apply` ist der einzige Schreiber. Ein einzelner
 * `ls-remote` ersetzt die Abfrage pro Branch, damit `pretask` auch bei vielen
 * Claims schnell bleibt.
 */
export function planReconcile({
  claims = [],
  baseRef = 'origin/main',
  git = defaultGit,
  gh = defaultGh,
  prIndex,
} = {}) {
  const mergedIndex = prIndex === undefined ? mergedPullRequestIndex({ gh, baseRef: 'main' }) : prIndex;
  const heads = remoteHeads({ git });
  let baseTip;
  try {
    baseTip = git(['rev-parse', baseRef]);
  } catch {
    baseTip = null;
  }
  const changes = [];
  const unresolved = [];
  for (const claim of claims.filter((item) => item?.status === 'open')) {
    const local = localMergeEvidence({ branch: claim.branch, baseRef, git });
    const remoteSha = heads?.get(claim.branch) ?? null;
    const mergedPr = mergedIndex?.get(claim.branch) ?? null;
    const branchExists = remoteSha !== null || local.headSha !== null;
    const branchAtBase =
      local.atBase ||
      Boolean(claim.baseSha && (local.headSha ?? remoteSha) === claim.baseSha) ||
      Boolean(remoteSha && baseTip && remoteSha === baseTip);
    const absenceKnown = !branchExists && heads !== null;
    const mergedOnMain = Boolean(
      mergedPr &&
        (branchExists ? branchAtBase : absenceKnown) &&
        commitOnMain({ sha: mergedPr.mergeCommit ?? mergedPr.headRefOid, baseRef, git }),
    );
    const evidence = decideClaim({
      branchExists,
      branchAtBase,
      branchHeadOnMain: local.headOnMain,
      branchTreeOnMain: local.treeOnMain,
      headSha: local.headSha ?? remoteSha,
      mergedPr,
      mergedOnMain,
    });
    if (evidence.status) {
      const sha =
        evidence.evidence === 'merged-pr'
          ? (mergedPr?.mergeCommit ?? mergedPr?.headRefOid ?? null)
          : evidence.evidence === 'branch-tree-on-main'
            ? local.treeOnMain
            : (local.headSha ?? remoteSha);
      changes.push({
        id: claim.id,
        branch: claim.branch,
        status: evidence.status,
        evidence: LIFECYCLE_EVIDENCE[evidence.evidence] ?? evidence.evidence,
        sha: sha ?? null,
        why: evidence.why,
        claim,
      });
      continue;
    }
    if (heads === null) unresolved.push({ id: claim.id, why: 'Remote nicht erreichbar, kein lokaler Beleg' });
    else if (!branchExists) unresolved.push({ id: claim.id, why: evidence.why });
  }
  return { changes, unresolved, prIndex: mergedIndex, remoteHeads: heads };
}
