#!/usr/bin/env node
/**
 * Pretask: der Start jedes Laufs.
 *
 * Der Lauf liest Git, Claims, Issues und den Impact-Plan. Er veraendert keine
 * Git-Dateien und schreibt nur `.verify-cache/task-state.json`. Die Modi:
 *
 * NEW     sauberer Start mit eigenem Claim
 * RESUME  adoptierbare WIP (eigene, fremde, unvollstaendige) im Claim-Scope
 * NOOP    HEAD == Basis; kein Startblocker
 * BLOCKED korrupte WIP (Ledger/Save/RNG/Boot), Claims, Issues
 *
 * `--new` und `--resume` erzwingen den passenden Modus. "Fremdes WIP" gibt es
 * nicht: kompatible, unvollstaendige und korrupte Aenderungen werden alle als
 * eigene Arbeit angenommen; nur korrupte halten den Start an. Ein geteilter
 * Arbeitsbaum ist der Normalfall; Isolation fordert nur `--require-worktree`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allowsPath, botClaim, findCollisions, isTaskContractPath, loadClaimsStrict, selectClaim } from './lib/lane-claims.mjs';
import { filterMergedCollisions, mergedPullRequestIndex, planReconcile } from './lib/claim-evidence.mjs';
import {
  deriveTaskState,
  loadTaskContractForClaim,
  readCiState,
  readPullRequestState,
  validateTaskContract,
} from './lib/task-contract.mjs';
import {
  ISOLATION_CODE,
  assessIsolation,
  foreignClaimPaths,
  isLinkedWorktree,
  isolationRequired,
  parseStatusPaths,
} from './lib/worktree-isolation.mjs';
import { impact as buildImpact } from './lib/impact.mjs';
import { ROOT } from './lib/report.mjs';
import { causeBlock, localCauses } from './agent-cause.mjs';
import { refreshBase } from './lib/base-refresh.mjs';
import { parseWorktrees, planCleanup } from './lib/branch-lifecycle.mjs';
import { TAKEOVER_CODE, classifyWip, summarizeTakeover } from './lib/takeover.mjs';
import { readAfterTask, resumeDecision, resumeTask } from './task-state.mjs';
import { buildFollowUp, classifyIssue as scopeDecision, labelNames } from './lib/issue-scope.mjs';

const argv = process.argv.slice(2);
// `--brief` ist die token-sparsame Form fuer Agenten: Status, Claim, Blocker
// und naechster Schritt. Sie impliziert JSON; die vollstaendige Form bleibt
// `--json` fuer Werkzeuge.
const brief = argv.includes('--brief');
const asJson = argv.includes('--json') || brief;
const wantNew = argv.includes('--new');
const wantResume = argv.includes('--resume');
const requireWorktree = argv.includes('--require-worktree') || process.env.RBD_REQUIRE_WORKTREE === '1';
/** Der Impact-Block wird nicht zweimal in die Ausgabe gelegt. */
const CONTEXT_FILE = '.verify-cache/agent-context.json';

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
const gitStrict = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const runOk = (args) => {
  try {
    execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
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
// Erst die Basis, dann jeder Diff: `agent-context` und die Pfadpruefung lesen
// denselben Ref; ohne Refresh rechnen sie gegen einen beliebig alten Stand.
const baseRefresh = refreshBase({ cwd: ROOT });
if (baseRefresh.moved) {
  notes.push(`Basis aktualisiert: ${baseRefresh.ref} ${baseRefresh.previous.slice(0, 7)} -> ${baseRefresh.sha.slice(0, 7)}`);
} else if (baseRefresh.failed) {
  warnings.push(`Basis nicht aktualisiert (${baseRefresh.reason}); Diff gegen ${baseRefresh.ref} kann veraltete Pfade zeigen`);
}
const originMain = baseRefresh.sha || run(['rev-parse', '--verify', 'origin/main']);
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

// Der Task-Vertrag ist die Wahrheit des Laufs. Ohne Vertrag bleibt eine
// Legacy-Lane startbar; mit Vertrag ist eine ungueltige Bindung rot.
const taskContractLoad = claim ? loadTaskContractForClaim(claim) : { contract: null, file: null, error: null };
if (taskContractLoad.error) {
  blockers.push(`[ERR-4019] ${taskContractLoad.error}`);
} else if (claim && taskContractLoad.contract) {
  const taskContractCheck = validateTaskContract(taskContractLoad.contract, { claim, branch });
  if (!taskContractCheck.ok) {
    for (const violation of taskContractCheck.violations) blockers.push(`[ERR-4019] Task-Vertrag: ${violation}`);
  }
}
const prState = claim && branch !== 'main' ? readPullRequestState({ branch }) : { known: false };
const ciState = claim && branch !== 'main' ? readCiState({ branch }) : { known: false, complete: false, conclusion: null };

let contextData = null;
let contextError = '';
try {
  // Derselbe Prozess statt eines zweiten Node-Starts: der fruehere
  // `agent-context`-Kindprozess rechnete den Impact ein zweites Mal und
  // kostete allein durch Start und JSON-Pipe mehrere hundert Millisekunden.
  contextData = buildImpact({ profile: 'quick' });
} catch (error) {
  contextError = error instanceof Error ? error.message : 'unbekannter Fehler';
}
if (!contextData || typeof contextData !== 'object') {
  blockers.push(`[ERR-4019] Impact-Plan fehlt oder ist nicht lesbar: ${contextError || 'leere Ausgabe'}`);
} else if (!Array.isArray(contextData.systems) || !contextData.tests) {
  blockers.push('[ERR-4019] Impact-Plan ist unvollstaendig: systems/tests fehlen');
}
// Die vollstaendige Fassung liegt neben dem Cache, damit Werkzeuge und
// Debugging denselben Stand lesen wie pretask.
const contextFile = CONTEXT_FILE;
try {
  mkdirSync(join(ROOT, '.verify-cache'), { recursive: true });
  writeFileSync(join(ROOT, CONTEXT_FILE), `${JSON.stringify(contextData, null, 2)}\n`, 'utf8');
} catch {
  warnings.push(`Kontextdatei ${CONTEXT_FILE} konnte nicht geschrieben werden`);
}

// Phase 3: lesender Reconcile vor der Kollisionspruefung. Geloeschte Branches,
// entfernte Worktrees und alte Doku erzeugen keine Geister-Kollision mehr;
// geschrieben wird ausschliesslich mit `reconcile-claims --apply`.
const prIndex = mergedPullRequestIndex();
const reconcile = planReconcile({ claims, baseRef: originMain || 'origin/main', git: gitStrict, prIndex });
const reconciledLanes = new Set(reconcile.changes.map((change) => change.id));
if (reconcile.changes.length > 0) {
  const sample = reconcile.changes.slice(0, 4).map((change) => `${change.id}:${change.evidence}`).join(', ');
  notes.push(`Reconcile: ${reconcile.changes.length} Claim(s) belegbar merged (${sample}${reconcile.changes.length > 4 ? ', ...' : ''}); Register mit 'reconcile-claims --apply' nachziehen`);
}

if (claim && branch !== 'main' && !botBranch) {
  // Dieselbe Reihenfolge wie im Lane-Claims-Gate: erst belegte Merges
  // herausfiltern, dann blockieren. Sonst wuerde der Start an Lanes
  // scheitern, die das Gate laengst als gemergt behandelt.
  const collisions = filterMergedCollisions({
    collisions: findCollisions(claim, claims).filter((collision) => !reconciledLanes.has(collision.lane)),
    claims,
    prIndex,
    onMerged: (collision, evidence) => {
      notes.push(`${collision.lane}: ${evidence.why}; als merged behandelt (Register nachziehen)`);
    },
  });
  if (collisions.length > 0) {
    blockers.push(
      `[ERR-4019] Lane-Kollisionen: ${collisions.map((entry) => `${entry.lane} (${entry.reason || 'Contract'})`).join('; ')}; erst Claim oder Pfade entzerren`,
    );
  }
}

/** Offene Issue-Labels, die den Start blockieren koennen; `governance/blocked`
 * schreibt `governance-issue`, nicht der Watcher. */
const ISSUE_LABELS = Object.freeze(['gate-failure', 'remote-ci', 'governance/blocked']);
/** Kontrollierte Wiederholung: erst zwei Versuche, dann Zustand UNKNOWN. */
const ISSUE_QUERY_ATTEMPTS = 2;

/** Issue-Scopes kommen aus `issue-scope`; pretask formuliert nur den Befund. */
function readIssues() {
  const issues = new Map();
  const errors = [];
  for (const label of ISSUE_LABELS) {
    let output = null;
    for (let attempt = 1; attempt <= ISSUE_QUERY_ATTEMPTS && output === null; attempt += 1) {
      try {
        // Tests koennen einen Node-basierten Stub einsetzen; im Betrieb bleibt
        // der normale GitHub-CLI-Aufruf der einzige Pfad.
        const ghBin = process.env.RBD_GH_BIN || 'gh';
        const ghArgs = process.env.RBD_GH_SCRIPT
          ? [process.env.RBD_GH_SCRIPT, 'issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title,url,labels,body', '--limit', '50']
          : ['issue', 'list', '--label', label, '--state', 'open', '--json', 'number,title,url,labels,body', '--limit', '50'];
        output = execFileSync(
          ghBin,
          ghArgs,
          { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
      } catch {
        output = null;
      }
    }
    if (output === null) {
      errors.push(label);
      continue;
    }
    try {
      for (const issue of JSON.parse(output)) {
        if (!issues.has(issue.number)) issues.set(issue.number, { ...issue, queryLabel: label });
      }
    } catch {
      // Eine unlesbare Antwort ist keine leere Liste.
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
  if (decision.reason === 'blocked-issue') {
    blockers.push(`[ERR-4019] Governance-BLOCKED #${issue.number} blockiert diese Lane`);
  } else if (decision.reason === 'scope-main') {
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
  // UNKNOWN unterscheidet jetzt lokal von Merge: ohne Issue-Abfrage ist die
  // Blockerlage unbekannt. Lokale Arbeit im Claim-Scope bleibt erlaubt (sonst
  // blockiert jede fehlende `gh`-Anmeldung den ganzen Turn), Merge und
  // Promotion bleiben fail-closed gesperrt.
  warnings.push(`[ERR-4019] Issue-Check UNKNOWN: ${issueCheck.errors.join(', ')} nicht abfragbar; lokale Arbeit erlaubt, Merge/Promotion gesperrt`);
  notes.push('Merge-Sperre: unbekannte Issue-Lage (Issue-Check UNKNOWN) haelt nur Merge und Promotion an.');
} else if (issueResults.length === 0) {
  notes.push('Issue-Check: keine offenen gate-failure-, remote-ci- oder governance/blocked-Issues.');
} else if (followUp.required) {
  notes.push(`Folgetask-Gate: ${followUp.problems.length} Problem(e) muessen zuerst geloest werden.`);
}

// Phase 3: Jede Branch ausser `main` ist temporaer. `pretask` raeumt nur
// administrative Worktree-Reste auf; Branches loescht ausschliesslich der
// Lifecycle-Lauf nach belegtem Merge.
const worktreesBefore = parseWorktrees(run(['worktree', 'list', '--porcelain']));
const mergedLocal = new Set(
  originMain ? pathList(run(['branch', '--merged', originMain, '--format=%(refname:short)'])) : [],
);
const cleanup = planCleanup({
  branches: pathList(run(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])).map((name) => ({
    name,
    merged: mergedLocal.has(name),
  })),
  worktrees: worktreesBefore,
  current: branch,
});
const worktreePrune = { ran: runOk(['worktree', 'prune']), pruned: cleanup.prune.length };
if (cleanup.prune.length > 0) notes.push(`Worktree-Reconcile: ${cleanup.prune.length} verwaiste Eintrag(e) geprunt.`);
if (cleanup.delete.length > 0) {
  notes.push(`Temporaere Branches mit Merge-Beleg: ${cleanup.delete.slice(0, 8).join(', ')}; Entfernen folgt im Lane-Finish/CI.`);
}

const foreignPaths = foreignClaimPaths({ changed: dirtyPaths, claims, branch, ownAllowlist: claim?.pathAllowlist ?? [] });
const ownWipPaths = claim
  ? dirtyPaths.filter((path) => claim.allowsPath(path) || isTaskContractPath(path))
  : [];
const outsideClaim = dirtyPaths.filter((path) => !claim || (!allowsPath(claim.pathAllowlist, path) && !isTaskContractPath(path)));
const unownedPaths = outsideClaim.filter((path) => !foreignPaths.includes(path));

// Phase 2: "Fremdes WIP" gibt es nicht. Jede Dirty-Datei wird klassifiziert
// und als eigene Arbeit angenommen; nur Korruption haelt den Start an.
const takeoverEntries = dirtyPaths
  .map((path) => classifyWip({
    path,
    claims,
    branch,
    allowlist: claim?.pathAllowlist ?? [],
  }))
  .filter(Boolean);
const takeover = summarizeTakeover(takeoverEntries);
for (const item of takeoverEntries.filter((entry) => entry.kind === 'corrupted')) {
  blockers.push(`[${TAKEOVER_CODE}] korrupte WIP: ${item.path} (${item.reason}); nicht automatisch uebernehmen`);
}

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
const dirtyAdoptable = dirtyPaths.length > 0 && takeover.blocked === 0;
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
else if (dirtyAdoptable) mode = 'RESUME';
else mode = 'NEW';

if (wantNew && wantResume) blockers.push('[ERR-4019] --new und --resume schliessen sich aus');
if (wantNew && mode !== 'NEW' && mode !== 'NOOP') blockers.push(`[ERR-4019] --new verlangt einen sauberen, isolierten NEW-Start (aktuell ${mode})`);
if (wantResume && mode !== 'RESUME') blockers.push(`[ERR-4019] --resume verlangt eigene WIP im verknuepften Worktree (aktuell ${mode})`);
if (blockers.length > 0) mode = 'BLOCKED';

// Die eine Statusableitung: READY, CONTINUE, AFTERCARE, MERGE_PENDING oder
// BLOCKED. CI_PENDING bleibt Phase und schlaegt eine parallele Lane vor,
// statt den Agenten warten zu lassen.
const taskState = deriveTaskState({
  contract: taskContractLoad.contract,
  claim,
  blockers,
  pr: prState,
  ci: ciState,
});
// Ein roter Verify-Bericht bleibt sichtbar, auch wenn pretask selbst nur
// Startbedingungen prueft. Der Block kommt aus derselben Quelle wie agent:cause.
const causes = localCauses();

const contextTests = contextData?.tests ?? {};
const longTests = contextTests.long ?? [];
const selectedTests = contextTests.runAll ? ['vollstaendige Suite'] : (contextTests.selected ?? []);
/** Was ein Commit dieses Scopes mitbringen muss; der Impact kennt die Pfade
 * bereits, also steht es hier statt erst im letzten Turn. */
const contentScope = (claim?.pathAllowlist ?? []).some((entry) =>
  /^(\.\/)?(src\/|content\/|public\/|index\.html$|package\.json$)/.test(entry),
);
const completionRequirements = [
  '`.turn-notes.md` inhaltlich fuellen (System, Befund, Test, Risiko), sonst wird der Commit ohne Begruendung erzeugt',
  'Commit-Nachricht mit den drei Pflichtsektionen; der Commit-Msg-Hook lehnt alles andere ab',
  ...(contentScope
    ? ['neuer Narrative-Baustein unter `content/narrative/contributions/`, im Manifest registriert und in der Registry verdrahtet']
    : []),
  'generierte Artefakte (Inventur, Roadmap-Zeile, Registry, Composer) nie per Hand editieren: `node scripts/sync-generated.mjs --all` ist der Eigentuemer',
];
const mergeBlocked = issueCheck.checked ? null : 'Issue-Check UNKNOWN: Issue-Lage unbekannt, Merge und Promotion gesperrt';
const requiredEvidence = [
  ...(claim ? [`Claim ${claim.id} (${claim.owner})`] : []),
  ...selectedTests.map((test) => `Test ${test}`),
  ...longTests.map((test) => `Long ${typeof test === 'string' ? test : test.file}`),
  ...(contextData?.gates ?? []).map((gate) => `Gate ${gate.name}`),
];
const nextActions = [];
if (blockers.length > 0) nextActions.push('Blockers aufloesen; korrupte WIP (Freeze, Ledger, Save, RNG, Boot) nicht automatisch uebernehmen.');
else if (mode === 'NOOP') nextActions.push('HEAD == Basis: neue Aufgabe/Commit anlegen oder bewusst beenden.');
else if (taskState.parallelLane?.suggested) nextActions.push(taskState.parallelLane.advice);
else if (taskState.nextAction) nextActions.push(taskState.nextAction);
else if (mode === 'RESUME') nextActions.push('Adoptierte WIP im Claim-Scope als eigene Arbeit fertigbauen; Abschluss ist der Branch-Scope-Finish.');
else if (mode === 'NEW') nextActions.push('Mit der ersten Aenderung innerhalb der Claim-Allowlist beginnen.');
else nextActions.push('Auf main keine Lane-Arbeit starten.');
if (taskState.status !== 'BLOCKED' && !taskState.parallelLane?.suggested) {
  nextActions.push('Vor dem Abschluss den betroffenen Verify-Plan ausfuehren.');
}

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
    takeover,
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
  takeover,
  cleanup,
  reconcile: {
    changes: reconcile.changes.map((change) => ({
      id: change.id,
      branch: change.branch,
      evidence: change.evidence,
      sha: change.sha,
      why: change.why,
    })),
    unresolved: reconcile.unresolved,
  },
  worktreePrune,
  completionRequirements,
  mergeBlocked,
  followUp,
  status: taskState.status,
  taskState: {
    ...taskState,
    file: taskContractLoad.file,
    contract: taskContractLoad.contract,
    pr: prState,
    ci: ciState,
  },
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
  takeover: takeover.blocked === 0,
  mode,
};
const taskStatePath = join(ROOT, '.verify-cache', 'task-state.json');
mkdirSync(join(ROOT, '.verify-cache'), { recursive: true });
writeFileSync(
  taskStatePath,
  `${JSON.stringify({ version: 1, mode, state, claimState, branch, head, base, worktree, taskStatus: taskState.status, taskInfo: contract.taskState, pr: prState, ci: ciState, baseRefresh, contract, blockers, warnings }, null, 2)}\n`,
  'utf8',
);

if (asJson) {
  if (brief) {
    console.log(JSON.stringify({
      ok: blockers.length === 0,
      mode,
      state,
      claimState,
      taskStatus: taskState.status,
      phase: taskState.phase,
      branch,
      base,
      head,
      claim: claimInfo ? { id: claimInfo.id, owner: claimInfo.owner, status: claimInfo.status, paths: claimInfo.allowlist.length } : null,
      task: contract.task.id,
      paths: { own: contract.paths.ownWip.length, foreign: contract.paths.foreign.length, unowned: contract.paths.unowned.length, adopted: takeover.adopted, corrupted: takeover.blocked },
      blockers,
      ...(causes.length > 0 ? { causes: causes.map(({ gate, fix, repro }) => ({ gate, fix, repro })) } : {}),
      warnings,
      nextActions,
      details: 'vollstaendig mit --json; Ursachen mit pnpm run agent:cause',
    }, null, 2));
    // Die Kurzform ist die ganze Antwort; kein zweiter Vollblock dahinter.
    process.exit(blockers.length > 0 ? 1 : 0);
  } else console.log(JSON.stringify({
    ok: blockers.length === 0,
    mode,
    state,
    claimState,
    checks,
    branch,
    head,
    base,
    worktree,
    taskStatus: taskState.status,
    taskInfo: contract.taskState,
    git: { dir: gitDir, commonDir, linked },
    baseRefresh,
    status: { staged: stagedPaths, unstaged: unstagedPaths, untracked: untrackedPaths },
    claim: claimInfo,
    issues: { ...issueCheck, issues: issueResults, mergeBlocked },
    mergeBlocked,
    followUp,
    context: contextData ? contextFile : null,
    isolation,
    takeover,
    reconcile: contract.reconcile,
    cleanup,
    worktreePrune,
    contract,
    taskState: '.verify-cache/task-state.json',
    blockers,
    causes,
    warnings,
    notes,
  }, null, 2));
} else {
  console.log(`pretask: Branch ${branch} · Modus ${mode}`);
  console.log('');
  console.log('=== Issue-Check ===');
  if (!issueCheck.checked) console.log(`  nicht ausgefuehrt: ${issueCheck.errors.join(', ')}`);
  else if (issueResults.length === 0) console.log('  keine offenen gate-failure-, remote-ci- oder governance/blocked-Issues');
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
  console.log(`  Status: ${taskState.status} · Phase ${taskState.phase} · offene Befunde: ${taskState.findings.length}`);
  console.log(`  Task: ${contract.task.id ?? '-'} / ${contract.task.description ?? '-'}`);
  console.log(`  Ziel: ${contract.task.goal || '-'}`);
  console.log(`  Worktree: ${worktree || '-'} (linked=${linked})`);
  console.log(`  Pfade erlaubt=${contract.paths.allowed.length} eigen=${contract.paths.ownWip.length} fremd=${contract.paths.foreign.length}`);
  console.log(`  WIP: ${takeover.total} adoptiert (${takeover.counts.compatible} kompatibel, ${takeover.counts.incomplete} unvollstaendig, ${takeover.counts.corrupted} korrupt)`);
  console.log(`  Systeme: ${contract.systems.join(', ') || 'keine'}`);
  console.log(`  Tests: ${contract.affectedTests.runAll ? 'vollstaendig' : contract.affectedTests.selected.length} · Long: ${contract.longTests.length} · Gates: ${contract.gates.length}`);
  for (const action of contract.nextActions) console.log(`  -> ${action}`);
  if (taskState.parallelLane?.suggested) console.log(`  Parallel: ${taskState.parallelLane.advice}`);
  if (causes.length > 0) {
    console.log('');
    console.log(causeBlock(causes));
  }
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
