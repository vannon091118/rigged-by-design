#!/usr/bin/env node
/**
 * Pretask: der Start jedes Laufs.
 *
 * Der Lauf liest Git, Claims, Issues und den Impact-Plan. Er veraendert keine
 * Git-Dateien und schreibt nur `.verify-cache/state.json`. Die Modi:
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
import { STATE_FILE, gcVerifyState, updateSection } from './lib/verify-state.mjs';
import {
  deriveTaskState, loadTaskContractForClaim, readCiState, readPullRequestState, validateTaskContract,
} from './lib/task-contract.mjs';
import { captureConsole } from './lib/compact.mjs';
import { localCauses } from './agent-cause.mjs';
import { ROOT } from './lib/report.mjs';
import { runIssueChecks } from './lib/pretask-issues.mjs';
import { printPretask } from './lib/pretask-output.mjs';
import { runWip } from './lib/pretask-wip.mjs';
import { runImpact } from './lib/pretask-impact.mjs';
import { runWorker } from './lib/pretask-worker.mjs';
import { resolveAgentIdentity, runSetup } from './lib/pretask-setup.mjs';
import { runBoard } from './lib/pretask-board.mjs';

const argv = process.argv.slice(2);
// `--brief` ist die token-sparsame Form fuer Agenten: Status, Claim, Blocker
// und naechster Schritt. Sie impliziert JSON; die vollstaendige Form bleibt
// `--json` fuer Werkzeuge.
const brief = argv.includes('--brief');
const asJson = argv.includes('--json') || brief;
// Texte bleiben im Budget; `--json` ist Werkzeugformat und vollstaendig.
captureConsole({ label: 'pretask', enabled: !asJson });
const wantNew = argv.includes('--new');
const findingFlag = argv.indexOf('--new-governance-issues');
const wantResume = argv.includes('--resume');
const requireWorktree = argv.includes('--require-worktree') || process.env.RBD_REQUIRE_WORKTREE === '1';
// Identitaet der Lane: `agent-<n>-local` bzw. `agent-<n>-cloud`. Alte Namen
// (`local.agent(cloud).1`) bleiben als Alias zulaessig; mehrere duerfen
// kommagetrennt in RBD_AGENT stehen.
const agentFlag = argv.indexOf('--agent');
const agentIdentity = resolveAgentIdentity(argv, agentFlag);
const blockers = [];
const warnings = [];
const notes = [];

const {
  actors, run, gitStrict, runOk, pathList, isAncestor, branch, head, worktree, gitDir, commonDir, linked,
  baseRefresh, originMain, stagedPaths, unstagedPaths, untrackedPaths, dirtyPaths, claimRegisterError,
  claims, claim, botBranch, base, claimInfo, issueClaim,
} = runSetup({ agentIdentity, blockers, warnings, notes });

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

const board = runBoard({ branch, notes, warnings });

const { contextData, contextFile, reconcile, automation, nextActionsHint } = runImpact({
  branch, dirtyPaths, claim, claims, originMain, gitStrict, blockers, warnings, notes, botBranch,
});

const { issueCheck, issueResults, followUp } = runIssueChecks({
  branch, claim, isAncestor, blockers, warnings, notes,
});

const {
  worktreePrune, cleanup, foreignPaths, ownWipPaths, unownedPaths, takeover, isolation, mode, resumed,
} = runWip({
  branch, head, base, originMain, claim, claims, dirtyPaths, run, runOk, pathList,
  blockers, warnings, notes, requireWorktree, wantNew, wantResume, linked,
});

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
if (nextActionsHint) nextActions.push(nextActionsHint);

const { worker, runBudgetState, workGate } = runWorker({
  argv, findingFlag, branch, claim, head, blockers, warnings, notes, issueClaim, actors,
});

const contract = {
  worker,
  workGate,
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
  issueClaim,
  board,
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
  runBudget: runBudgetState,
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
      pr: change.pr ?? null,
      branchCleanup: change.branchCleanup ?? null,
    })),
    unresolved: reconcile.unresolved,
  },
  automation,
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
updateSection('task', {
  version: 1, mode, state, claimState, branch, head, base, worktree,
  taskStatus: taskState.status, taskInfo: contract.taskState, automation,
  pr: prState, ci: ciState, baseRefresh, contract, blockers, warnings,
});
// Ein Aufraeumpfad fuer den ganzen Cache, nicht einer je Artefakt.
const cleaned = gcVerifyState({ root: ROOT });
if (cleaned.removed.length > 0) notes.push(`Cache aufgeraeumt: ${cleaned.removed.length} Eintrag/Eintraege (TTL)`);

printPretask({
  asJson, brief, blockers, mode, state, claimState, taskState, branch, base, head,
  claimInfo, issueClaim, worker, workGate, board, automation, contract, takeover,
  causes, warnings, notes, nextActions, checks, worktree, gitDir, commonDir, linked,
  baseRefresh, stagedPaths, unstagedPaths, untrackedPaths, issueCheck, issueResults,
  mergeBlocked, followUp, contextData, contextFile, isolation, cleanup, worktreePrune,
  agentIdentity, stateFile: STATE_FILE,
});
