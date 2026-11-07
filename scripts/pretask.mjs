#!/usr/bin/env node
/**
 * Pretask: der Start jedes Laufs.
 *
 * Reihenfolge: erst Issue-Check und offengelassene Konflikte auflösen, dann
 * neue Arbeit. Der Lauf prueft nur und schreibt nichts; er macht sichtbar, was
 * vor dem ersten Edit zu klaeren ist.
 *
 * Exit 1 bei Startblockern: ungeloester Merge/Rebase, unmerged Pfade,
 * Konfliktmarker, ein offenes gate-failure-Issue, ein schmutziger Arbeitsbaum,
 * ein fehlender Impact-Plan oder ein fehlender/kollidierender Lane-Claim.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { allowsPath, findCollisions, loadClaimsStrict, selectClaim } from './lib/lane-claims.mjs';
import {
  ISOLATION_CODE,
  assessIsolation,
  foreignClaimPaths,
  isLinkedWorktree,
  isolationRequired,
  parseStatusPaths,
} from './lib/worktree-isolation.mjs';
import { ROOT } from './lib/report.mjs';

const run = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

const blockers = [];
const notes = [];
const argv = process.argv.slice(2);
const requireWorktree = argv.includes('--require-worktree') || process.env.RBD_REQUIRE_WORKTREE === '1';
const asJson = argv.includes('--json');

const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']) || '(unbekannt)';
const head = run(['rev-parse', 'HEAD']);
const worktree = run(['rev-parse', '--show-toplevel']);
const gitDir = run(['rev-parse', '--absolute-git-dir']);
const commonDir = run(['rev-parse', '--path-format=absolute', '--git-common-dir']);
const pathList = (text) => (text ? text.split(/\r?\n/).filter(Boolean) : []);
const stagedPaths = pathList(run(['diff', '--cached', '--name-only']));
const unstagedPaths = pathList(run(['diff', '--name-only']));
const untrackedPaths = pathList(run(['ls-files', '--others', '--exclude-standard']));

/** Offene gate-failure-Issues werden unten zum Startblocker; remote-ci bleibt Kontext. */
function readIssues() {
  const labels = ['gate-failure', 'remote-ci'];
  const issues = [];
  const errors = [];
  for (const label of labels) {
    try {
      const output = execFileSync('gh', [
        'issue', 'list', '--label', label, '--state', 'open',
        '--json', 'number,title,url,labels', '--limit', '20',
      ], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const issue of JSON.parse(output)) issues.push({ ...issue, label });
    } catch {
      errors.push(label);
    }
  }
  return { checked: errors.length === 0, status: errors.length === 0 ? 'checked' : 'unknown', issues, errors };
}

const issues = readIssues();
const openGateFailures = issues.issues.filter((issue) => issue.label === 'gate-failure');
if (openGateFailures.length > 0) {
  blockers.push(`[ERR-4019] offene gate-failure-Issues: ${openGateFailures.map((issue) => `#${issue.number}`).join(', ')}; erst schliessen oder den Auftrag ausdruecklich abgrenzen`);
}

let context = '';
let contextError = '';
try {
  context = execFileSync(process.execPath, ['scripts/agent-context.mjs', '--line'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch (error) {
  contextError = error instanceof Error ? error.message : 'unbekannter Fehler';
}
if (!context) {
  blockers.push(`[ERR-4019] Impact-Plan fehlt: agent:context lieferte keine Ausgabe (${contextError || 'leer'}); erst den Arbeitsbrief erzeugen`);
}

/** 1. Bewusst offengelassene Konflikte: sie werden hier aufgeloest, nicht am Ende. */
for (const marker of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
  const path = run(['rev-parse', '--git-path', marker]);
  if (path && existsSync(join(ROOT, path))) blockers.push(`laufender ${marker.replace(/-/g, ' ')}: erst abschliessen oder abbrechen`);
}

const unmerged = run(['diff', '--name-only', '--diff-filter=U']);
if (unmerged) blockers.push(`unmerged Pfade:\n    ${unmerged.split(/\r?\n/).join('\n    ')}`);

const conflictMarkers = run(['grep', '-n', '-E', '^(<<<<<<<|>>>>>>>) ', '--', '.']);
if (conflictMarkers) blockers.push(`Konfliktmarker im Baum:\n    ${conflictMarkers.split(/\r?\n/).slice(0, 8).join('\n    ')}`);

/** 2. Lane-Claim und Kollisionen. */
let allClaims = [];
let claimRegisterError = '';
try {
  allClaims = loadClaimsStrict();
} catch (error) {
  claimRegisterError = error instanceof Error ? error.message : 'unbekannter Fehler';
}
const claims = allClaims.filter((c) => c.status === 'open');
const claim = selectClaim(allClaims, branch);
if (claimRegisterError) {
  blockers.push(`[ERR-4019] Claim-Register nicht lesbar: ${claimRegisterError}`);
}
const originMain = run(['rev-parse', '--verify', 'origin/main']);
const base = (originMain && run(['merge-base', 'HEAD', originMain])) || claim?.baseSha || '';
const claimInfo = claim
  ? {
      id: claim.id,
      owner: claim.owner,
      branch: claim.branch,
      baseSha: claim.baseSha,
      task: claim.task || '',
      allowlist: claim.pathAllowlist.length,
      contracts: claim.writeContracts(),
    }
  : null;
if (branch === 'main') {
  notes.push('main ist durch den Branch-Schutz gedeckt; keine Lane noetig.');
} else if (!claim) {
  // Vor dem ersten Edit, nicht erst beim Commit: der Claim ist die Schreibgrenze.
  blockers.push(`[ERR-4019] kein Lane-Claim fuer '${branch}'; zuerst mit 'pnpm run claim:register' registrieren`);
} else {
  notes.push(`Lane ${claim.id}: ${claim.pathAllowlist.length} Pfad(e), Contracts ${claim.writeContracts().join(', ') || '(keine)'}.`);
  const collisions = findCollisions(claim, claims);
  if (collisions.length > 0) {
    blockers.push(`[ERR-4019] Lane-Kollisionen: ${collisions.map((c) => `${c.lane} (${c.reason || 'Contract'})`).join('; ')}; erst Claim oder Pfade entzerren`);
  }
}

/**
 * 2b. Arbeitsbaum-Isolation. Ein fremder offener Claim oder ein explizites
 * `--require-worktree` macht den geteilten Baum zum Startblocker. Ein eigener
 * verknuepfter Worktree ist der einzige erlaubte Ort; der eigene Schmutz dort
 * ist normale Arbeit und kein Befund.
 */
const dirtyPaths = parseStatusPaths(run(['status', '--porcelain=v1', '--untracked-files=all']));
if (dirtyPaths.length > 0) {
  blockers.push(`[ERR-4019] Arbeitsbaum nicht leer: ${dirtyPaths.slice(0, 8).join(', ')}${dirtyPaths.length > 8 ? ` und ${dirtyPaths.length - 8} weitere` : ''}; erst abschliessen oder bewusst fortsetzen, keine fremde WIP mitnehmen`);
}
if (claim && dirtyPaths.length > 0) {
  const outside = dirtyPaths.filter((path) =>
    path !== '.turn-notes.md'
    && !path.startsWith('.verify-cache/')
    && !allowsPath(claim.pathAllowlist, path));
  if (outside.length > 0) {
    notes.push(`WIP ausserhalb der Claim-Allowlist: ${outside.slice(0, 8).join(', ')}; turn:finish blockt.`);
  }
}
const isolation = assessIsolation({
  required: isolationRequired({ explicit: requireWorktree, claims, branch }),
  isWorktree: isLinkedWorktree(
    run(['rev-parse', '--absolute-git-dir']),
    run(['rev-parse', '--path-format=absolute', '--git-common-dir']),
  ),
  dirtyPaths,
  foreignPaths: foreignClaimPaths({ changed: dirtyPaths, claims, branch }),
  branch,
});
if (!isolation.ok) {
  blockers.push(
    `[${ISOLATION_CODE}] isolation: ${isolation.reasons.join(', ')}; `
      + `dirty=${isolation.dirtyPaths.length} foreign=${isolation.foreignPaths.join(',') || '(keine)'}`,
  );
} else if (isolation.required) {
  notes.push(`Isolation: eigener Worktree (${branch}).`);
}

/** 3. Liegengebliebene Staende, die niemand versehentlich verlieren soll. */
const stashes = run(['stash', 'list']);
if (stashes) notes.push(`${stashes.split(/\r?\n/).length} Stash(es) vorhanden: ${stashes.split(/\r?\n/)[0]}`);

if (issues.checked) {
  if (issues.issues.length === 0) notes.push('Issue-Check: keine offenen gate-failure- oder remote-ci-Issues.');
  else for (const issue of issues.issues) notes.push(`Issue #${issue.number} [${issue.label}]: ${issue.title}`);
} else {
  notes.push(`Issue-Check nicht ausgefuehrt (gh fehlt oder ist nicht angemeldet): ${issues.errors.join(', ')}; Befehle stehen unten.`);
}

const state = blockers.length > 0 ? 'TASK_BLOCKED' : 'SCOPE_VALID';
const checks = {
  bootstrap: true,
  claim: Boolean(claim),
  scope: Boolean(claim) && blockers.length === 0,
  isolation: isolation.ok,
};

if (asJson) {
  console.log(JSON.stringify({
    ok: blockers.length === 0,
    state,
    checks,
    branch,
    head,
    base,
    worktree,
    git: { dir: gitDir, commonDir },
    status: { staged: stagedPaths, unstaged: unstagedPaths, untracked: untrackedPaths },
    claim: claimInfo,
    issues,
    context,
    isolation,
    blockers,
    notes,
  }, null, 2));
} else {
  console.log(`pretask: Branch ${branch}`);
  console.log('');
  console.log('=== Issue-Check (Pflicht, erste Arbeit) ===');
  if (!issues.checked) {
    console.log('  gh issue list --label gate-failure --state open');
    console.log('  gh issue list --label remote-ci --state open');
  } else if (issues.issues.length === 0) {
    console.log('  keine offenen gate-failure- oder remote-ci-Issues');
  } else {
    for (const issue of issues.issues) console.log(`  #${issue.number} [${issue.label}] ${issue.title} — ${issue.url}`);
  }
  console.log('  Ein offenes gate-failure-Issue ist der alleinige Fokus, bis es geschlossen ist.');
  for (const note of notes) console.log(`  - ${note}`);
}

if (blockers.length > 0) {
  if (!asJson) {
    console.error('');
    console.error('pretask: STARTBLOCKER - erst aufloesen, dann neue Arbeit:');
    for (const blocker of blockers) console.error(`  - ${blocker}`);
  }
  process.exit(1);
}

if (!asJson) {
  console.log('');
  if (context) {
    console.log('=== Arbeitsbrief ===');
    console.log(`  Branch: ${branch}`);
    console.log(`  HEAD: ${head || '-'}`);
    console.log(`  Basis: ${base || '-'}`);
    console.log(`  Worktree: ${worktree || '-'} (linked=${isolation.isWorktree})`);
    if (claimInfo) console.log(`  Claim: ${claimInfo.id} / ${claimInfo.owner} / ${claimInfo.allowlist} Pfad(e)`);
    console.log(`  Status: staged=${stagedPaths.length} unstaged=${unstagedPaths.length} untracked=${untrackedPaths.length}`);
    console.log(context);
    console.log('');
  }
  console.log(`pretask: ${state} - neue Arbeit erlaubt.`);
  console.log('  Arbeit: pnpm run turn:finish führt die betroffenen schnellen Tests aus; lange Nachweise übernimmt CI.');
}
