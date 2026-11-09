#!/usr/bin/env node
/**
 * Pretask: der Start jedes Laufs.
 *
 * Der Lauf liest Git, Claims, Issues und den Impact-Plan. Er veraendert keine
 * Git-Dateien und schreibt nur `.verify-cache/task-state.json`. Die Modi:
 *
 * NEW     sauberer, isolierter Worktree mit eigenem Claim
 * RESUME  eigener Claim und ausschliesslich eigene WIP im verknuepften Worktree
 * NOOP    HEAD == Basis; kein Startblocker
 * BLOCKED fremder Schmutz, geteilter Worktree, Claim-/Issue-/Scope-Blocker
 *
 * `--new` und `--resume` erzwingen den passenden Modus. Ein fremder Pfad wird
 * nie angefasst; er bleibt Blocker, bis sein Owner ihn aufloest.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allowsPath, botClaim, findCollisions, loadClaimsStrict, selectClaim } from './lib/lane-claims.mjs';
import {
  ISOLATION_CODE,
  assessIsolation,
  foreignClaimPaths,
  isLinkedWorktree,
  isolationRequired,
  parseStatusPaths,
} from './lib/worktree-isolation.mjs';
import { ROOT } from './lib/report.mjs';
import { readAfterTask, resumeDecision, resumeTask } from './task-state.mjs';
import { buildFollowUp, classifyIssue as scopeDecision, labelNames } from './lib/issue-scope.mjs';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const wantNew = argv.includes('--new');
const wantResume = argv.includes('--resume');
const requireWorktree = argv.includes('--require-worktree') || process.env.RBD_REQUIRE_WORKTREE === '1';

const blockers = [];
const warnings = [];
const notes = [];

const run = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const pathList = (text) => (text ? text.split(/\r?\n/).filter(Boolean) : []);
const isAncestor = (sha) => {
  if (!/^[0-9a-f]{40}$/.test(String(sha ?? ''))) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']) || '(unbekannt)';
const head = run(['rev-parse', 'HEAD']);
const worktree = run(['rev-parse', '--show-toplevel']);
const gitDir = run(['rev-parse', '--absolute-git-dir']);
const commonDir = run(['rev-parse', '--path-format=absolute', '--git-common-dir']);
const linked = isLinkedWorktree(gitDir, commonDir);
const originMain = run(['rev-parse', '--verify', 'origin/main']);
const mergeBase = originMain && head ? run(['merge-base', 'HEAD', originMain]) : '';

const stagedPaths = pathList(run(['diff', '--cached', '--name-only']));
const unstagedPaths = pathList(run(['diff', '--name-only']));
const untrackedPaths = pathList(run(['ls-files', '--others', '--exclude-standard']));
const rawDirtyPaths = parseStatusPaths(run(['status', '--porcelain=v1', '--untracked-files=all']));
// Der eigene Zustandsbericht ist kein fremder Schmutz; .verify-cache ist
// ausdruecklich fluechtig und darf den naechsten Pretask-Lauf nicht blockieren.
const ignoredWip = (path) => path === '.turn-notes.md' || path.startsWith('.verify-cache/');
const dirtyPaths = rawDirtyPaths.filter((path) => !ignoredWip(path));

let allClaims = [];
let claimRegisterError = '';
try {
  allClaims = loadClaimsStrict();
} catch (error) {
  claimRegisterError = error instanceof Error ? error.message : 'unbekannter Fehler';
  blockers.push(`[ERR-4019] Claim-Register nicht lesbar: ${claimRegisterError}`);
}
const claims = allClaims.filter((claim) => claim.status === 'open');
// selectClaim fuehrt auch einen gemergten Claim auf seinem Branch weiter.
const laneClaim = selectClaim(allClaims, branch);
const claim = laneClaim ?? botClaim(branch);
const botBranch = laneClaim === null && claim !== null;
const base = mergeBase || claim?.baseSha || '';
const claimInfo = claim
  ? {
      id: claim.id,
      owner: claim.owner,
      branch: claim.branch,
      baseSha: claim.baseSha,
      status: claim.status,
      task: claim.task || '',
      goal: claim.goal || '',
      dependencies: claim.dependencies ?? [],
      allowlist: claim.pathAllowlist ?? [],
      contracts: claim.writeContracts(),
    }
  : null;

if (branch !== 'main' && !claim) {
  blockers.push(`[ERR-4019] kein Lane-Claim fuer '${branch}'; zuerst mit 'pnpm run claim:register' registrieren`);
}
if (branch === 'main' && !claim) notes.push('main ist durch den Branch-Schutz gedeckt; keine Lane noetig.');

let contextData = null;
let contextError = '';
try {
  const output = execFileSync(process.execPath, ['scripts/agent-context.mjs', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  contextData = JSON.parse(output);
} catch (error) {
  contextError = error instanceof Error ? error.message : 'unbekannter Fehler';
}
if (!contextData || typeof contextData !== 'object') {
  blockers.push(`[ERR-4019] Impact-Plan fehlt oder ist nicht JSON: ${contextError || 'leere Ausgabe'}`);
} else if (!Array.isArray(contextData.systems) || !contextData.tests) {
  blockers.push('[ERR-4019] Impact-Plan ist unvollstaendig: systems/tests fehlen');
}

if (claim && branch !== 'main' && !botBranch) {
  const collisions = findCollisions(claim, claims);
  if (collisions.length > 0) {
    blockers.push(
      `[ERR-4019] Lane-Kollisionen: ${collisions.map((entry) => `${entry.lane} (${entry.reason || 'Contract'})`).join('; ')}; erst Claim oder Pfade entzerren`,
    );
  }
}

/** Issue-Scopes kommen aus `issue-scope`; pretask formuliert nur den Befund. */
function readIssues() {
  const issues = new Map();
  const errors = [];
  for (const label of ['gate-failure', 'remote-ci']) {
    try {
      // Tests koennen einen Node-basierten Stub einsetzen; im Betrieb bleibt
      // der normale GitHub-CLI-Aufruf der einzige Pfad.
      const ghBin = process.env.RBD_GH_BIN || 'gh';
      const ghArgs = process.env.RBD_GH_SCRIPT
        ? [process.env.RBD_GH_SCRIPT, 'issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title,url,labels,body', '--limit', '50']
        : ['issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title,url,labels,body', '--limit', '50'];
      const output = execFileSync(
        ghBin,
        ghArgs,
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      for (const issue of JSON.parse(output)) {
        if (!issues.has(issue.number)) issues.set(issue.number, { ...issue, queryLabel: label });
      }
    } catch {
      errors.push(label);
    }
  }
  return { checked: errors.length === 0, status: errors.length === 0 ? 'checked' : 'unknown', issues: [...issues.values()], errors };
}

function classifyIssue(issue) {
  const decision = scopeDecision(issue, {
    branch,
    dependencies: claim?.dependencies ?? [],
    isAncestor,
  });
  const result = {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    body: issue.body ?? '',
    labels: labelNames(issue),
    scope: decision.scope,
    repairSha: decision.repairSha,
  };
  if (decision.disposition === 'warning') {
    if (decision.reason === 'remote-ci') {
      warnings.push(`Issue #${issue.number}: remote-ci blockiert nie`);
    } else if (decision.reason === 'repair-already-in-head') {
      warnings.push(`Issue #${issue.number}: Repair-SHA ${decision.repairSha.slice(0, 7)} ist bereits Vorfahr von HEAD`);
    } else if (decision.reason === 'no-scope') {
      warnings.push(`Issue #${issue.number}: gate-failure ohne Scope-Label; nicht global blockieren`);
    } else {
      warnings.push(`Issue #${issue.number}: Scope ${decision.scope.lane || decision.scope.kind} betrifft diese Lane nicht`);
    }
    return { ...result, disposition: 'warning', reason: decision.reason };
  }
  if (decision.reason === 'scope-main') {
    blockers.push(`[ERR-4019] gate-failure #${issue.number} scope:main blockiert global`);
  } else if (decision.reason === 'scope-lane') {
    blockers.push(`[ERR-4019] gate-failure #${issue.number} betrifft die eigene Lane (${decision.scope.lane})`);
  } else {
    blockers.push(`[ERR-4019] gate-failure #${issue.number} betrifft die Dependency ${decision.scope.lane}`);
  }
  return { ...result, disposition: 'blocker', reason: decision.reason };
}

const issueCheck = readIssues();
const issueResults = issueCheck.issues.map(classifyIssue);
const followUp = buildFollowUp(issueResults);
if (!issueCheck.checked) {
  warnings.push(`Issue-Check nicht ausgefuehrt: ${issueCheck.errors.join(', ')}`);
} else if (issueResults.length === 0) {
  notes.push('Issue-Check: keine offenen gate-failure- oder remote-ci-Issues.');
} else if (followUp.required) {
  notes.push(`Folgetask-Gate: ${followUp.problems.length} Problem(e) muessen zuerst geloest werden.`);
}

const foreignPaths = foreignClaimPaths({ changed: dirtyPaths, claims, branch, ownAllowlist: claim?.pathAllowlist ?? [] });
const ownWipPaths = claim ? dirtyPaths.filter((path) => claim.allowsPath(path)) : [];
const outsideClaim = dirtyPaths.filter((path) => !claim || !allowsPath(claim.pathAllowlist, path));
const unownedPaths = outsideClaim.filter((path) => !foreignPaths.includes(path));

const isolation = {
  ...assessIsolation({
    required: isolationRequired({ explicit: requireWorktree, claims, branch }),
    isWorktree: linked,
    dirtyPaths,
    foreignPaths,
    branch,
  }),
  ownWipPaths,
  unownedPaths,
};
if (!isolation.ok) {
  blockers.push(
    `[${ISOLATION_CODE}] isolation: ${isolation.reasons.join(', ')}; dirty=${dirtyPaths.length} foreign=${foreignPaths.join(',') || '(keine)'}`,
  );
}
if (dirtyPaths.length > 0) {
  if (!linked || !claim || branch === 'main') {
    blockers.push(`[ERR-4019] Arbeitsbaum nicht leer: ${dirtyPaths.slice(0, 8).join(', ')}; erst abschliessen oder bewusst fortsetzen, keine fremde WIP mitnehmen`);
  } else {
    if (foreignPaths.length > 0) {
      blockers.push(`[ERR-4019] fremde WIP in Claim-Pfaden: ${foreignPaths.slice(0, 8).join(', ')}; nicht anfassen`);
    }
    if (unownedPaths.length > 0) {
      blockers.push(`[ERR-4019] Arbeitsbaum nicht leer: WIP ausserhalb der eigenen Claim-Allowlist (${unownedPaths.slice(0, 8).join(', ')}); nicht anfassen`);
    }
  }
}

const dirtyOwnOnly = dirtyPaths.length > 0 && outsideClaim.length === 0 && foreignPaths.length === 0;
let mode;
let resumed = null;
if (wantResume && blockers.length === 0) {
  const decision = resumeDecision({
    record: readAfterTask(),
    branch,
    claim,
    isWorktree: linked,
    dirtyPaths,
  });
  if (decision.ok) {
    resumeTask({ record: readAfterTask(), branch, claim, isWorktree: linked, dirtyPaths });
    resumed = decision.state;
    if (resumed) notes.push(`Resume: Zustand ${resumed} wiederhergestellt.`);
  } else {
    blockers.push(`[ERR-4019] Resume nicht moeglich: ${decision.reasons.join('; ')}`);
  }
}

if (blockers.length > 0) mode = 'BLOCKED';
else if (branch === 'main') mode = 'GLOBAL';
else if (head && base && head === base) mode = 'NOOP';
else if (dirtyOwnOnly) mode = 'RESUME';
else mode = 'NEW';

if (wantNew && wantResume) blockers.push('[ERR-4019] --new und --resume schliessen sich aus');
if (wantNew && mode !== 'NEW' && mode !== 'NOOP') blockers.push(`[ERR-4019] --new verlangt einen sauberen, isolierten NEW-Start (aktuell ${mode})`);
if (wantResume && mode !== 'RESUME') blockers.push(`[ERR-4019] --resume verlangt eigene WIP im verknuepften Worktree (aktuell ${mode})`);
if (blockers.length > 0) mode = 'BLOCKED';

const contextTests = contextData?.tests ?? {};
const longTests = contextTests.long ?? [];
const selectedTests = contextTests.runAll ? ['vollstaendige Suite'] : (contextTests.selected ?? []);
const requiredEvidence = [
  ...(claim ? [`Claim ${claim.id} (${claim.owner})`] : []),
  ...selectedTests.map((test) => `Test ${test}`),
  ...longTests.map((test) => `Long ${typeof test === 'string' ? test : test.file}`),
  ...(contextData?.gates ?? []).map((gate) => `Gate ${gate.name}`),
];
const nextActions = [];
if (blockers.length > 0) nextActions.push('Blockers aufloesen; fremde WIP und Scope-Issues nicht anfassen.');
else if (mode === 'NOOP') nextActions.push('HEAD == Basis: neue Aufgabe/Commit anlegen oder bewusst beenden.');
else if (mode === 'RESUME') nextActions.push('Eigene WIP im verknuepften Worktree fortsetzen; fremde Pfade unangetastet lassen.');
else if (mode === 'NEW') nextActions.push('Mit der ersten Aenderung innerhalb der Claim-Allowlist beginnen.');
else nextActions.push('Auf main keine Lane-Arbeit starten.');
nextActions.push('Vor dem Abschluss den betroffenen Verify-Plan ausfuehren.');

const contract = {
  task: {
    id: claim?.id ?? null,
    description: claim?.task ?? null,
    goal: claim?.goal ?? null,
    branch,
    head,
    base,
    worktree,
    owner: claim?.owner ?? null,
  },
  claim: claimInfo,
  paths: {
    allowed: claim?.pathAllowlist ?? [],
    ownWip: ownWipPaths,
    foreign: foreignPaths,
    unowned: unownedPaths,
  },
  systems: contextData?.systems ?? [],
  affectedTests: {
    runAll: Boolean(contextTests.runAll),
    selected: selectedTests,
    fast: contextTests.fast ?? [],
    long: longTests,
  },
  gates: contextData?.gates ?? [],
  longTests,
  followUp,
  blockers,
  warnings,
  requiredEvidence,
  nextActions,
};

const claimState = claimRegisterError ? 'CLAIM_INVALID' : claim ? 'CLAIM_VALID' : 'CLAIM_MISSING';
let state = blockers.length > 0 ? 'TASK_BLOCKED' : mode === 'NOOP' ? 'NOOP' : 'SCOPE_VALID';
if (resumed) state = resumed;
const checks = {
  bootstrap: true,
  claim: Boolean(claim),
  claimState,
  scope: Boolean(claim) && blockers.length === 0,
  scopeState: state,
  isolation: isolation.ok,
  mode,
};
const taskStatePath = join(ROOT, '.verify-cache', 'task-state.json');
mkdirSync(join(ROOT, '.verify-cache'), { recursive: true });
writeFileSync(
  taskStatePath,
  `${JSON.stringify({ version: 1, mode, state, claimState, branch, head, base, worktree, contract, blockers, warnings }, null, 2)}\n`,
  'utf8',
);

if (asJson) {
  console.log(JSON.stringify({
    ok: blockers.length === 0,
    mode,
    state,
    claimState,
    checks,
    branch,
    head,
    base,
    worktree,
    git: { dir: gitDir, commonDir, linked },
    status: { staged: stagedPaths, unstaged: unstagedPaths, untracked: untrackedPaths },
    claim: claimInfo,
    issues: { ...issueCheck, issues: issueResults },
    followUp,
    context: contextData,
    isolation,
    contract,
    taskState: '.verify-cache/task-state.json',
    blockers,
    warnings,
    notes,
  }, null, 2));
} else {
  console.log(`pretask: Branch ${branch} · Modus ${mode}`);
  console.log('');
  console.log('=== Issue-Check ===');
  if (!issueCheck.checked) console.log(`  nicht ausgefuehrt: ${issueCheck.errors.join(', ')}`);
  else if (issueResults.length === 0) console.log('  keine offenen gate-failure- oder remote-ci-Issues');
  else for (const issue of issueResults) console.log(`  #${issue.number} [${issue.scope.kind}${issue.scope.lane ? `:${issue.scope.lane}` : ''}] ${issue.disposition}: ${issue.title}`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
  for (const note of notes) console.log(`  - ${note}`);
  if (followUp.required) {
    console.log('');
    console.log('=== Folgetask-Gate ===');
    console.log(`  ${followUp.headline}`);
    for (const problem of followUp.problems) {
      console.log('');
      console.log(`  ${problem.title}${problem.number ? ` (${problem.number})` : ''}`);
      console.log(`  Kurzbeschreibung: ${problem.summary}`);
      console.log(`  Lösungsansatz: ${problem.approach}`);
      console.log(`  Schwierigkeitsgrad: ${problem.difficulty}`);
    }
    console.log('');
    console.log('  -> Diese Anfrage erst als Folgetask starten; keine neue Lane-Arbeit vorher.');
  }
  console.log('');
  console.log('=== Task-Vertrag ===');
  console.log(`  Task: ${contract.task.id ?? '-'} / ${contract.task.description ?? '-'}`);
  console.log(`  Ziel: ${contract.task.goal || '-'}`);
  console.log(`  Worktree: ${worktree || '-'} (linked=${linked})`);
  console.log(`  Pfade erlaubt=${contract.paths.allowed.length} eigen=${contract.paths.ownWip.length} fremd=${contract.paths.foreign.length}`);
  console.log(`  Systeme: ${contract.systems.join(', ') || 'keine'}`);
  console.log(`  Tests: ${contract.affectedTests.runAll ? 'vollstaendig' : contract.affectedTests.selected.length} · Long: ${contract.longTests.length} · Gates: ${contract.gates.length}`);
  for (const action of contract.nextActions) console.log(`  -> ${action}`);
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
  console.log(`pretask: ${state} (${claimState}) - neue Arbeit erlaubt.`);
  console.log(`  Zustand: ${taskStatePath}`);
  console.log('  Arbeit: pnpm run turn:finish fuehrt die betroffenen schnellen Tests aus; lange Nachweise uebernimmt CI.');
}
