/**
 * Task-Vertrag: die eine Wahrheit eines Laufs.
 *
 * Der Vertrag liegt als `.lane-claims/tasks/<taskId>.json` im Branch und
 * beschreibt Phase, offene Befunde, PR-Zustand und die naechste Aktion. Er ist
 * kein Cache: `pretask`, `turn:finish`, `ci-plan` und `promote` lesen und
 * validieren ihn ueber dieselbe Funktion. `.verify-cache/task-state.json`
 * bleibt eine fluechtige Kopie fuer den lokalen Ablauf.
 *
 * Phasen:
 *   READY          Task beschrieben, noch kein lokaler Turn
 *   IMPLEMENTING   Arbeit laeuft, noch nicht gepusht
 *   CI_PENDING     gepusht, der PR-Lauf ist die Autoritaet
 *   MERGE_PENDING  PR-Lauf gruen, Merge steht an
 *   AFTERCARE      Nachsorge offen (vor oder nach Merge); haelt den Merge
 *   DONE           abgeschlossen; neue Arbeit = neue Lane
 *
 * `BLOCKED` ist kein Vertragszustand, sondern das Ergebnis von pretask, wenn
 * Claim, Scope, Issue oder Isolation blockieren. So bleibt der Vertrag ehrlich:
 * eine Blockade ist ein Befund, keine Phase.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';
import { TASK_CONTRACT_PREFIX } from './lane-claims.mjs';
import { latestCiState, readCiStateResult } from './ci-state.mjs';

export const TASK_DIR = TASK_CONTRACT_PREFIX;
export const TASK_PHASES = Object.freeze(['READY', 'IMPLEMENTING', 'CI_PENDING', 'MERGE_PENDING', 'AFTERCARE', 'DONE']);
export const PRETASK_STATUSES = Object.freeze(['READY', 'CONTINUE', 'AFTERCARE', 'MERGE_PENDING', 'BLOCKED']);
export const FINDING_STATUSES = Object.freeze(['open', 'resolved', 'accepted']);
export const FINDING_SEVERITIES = Object.freeze(['blocker', 'warning', 'info']);
export const PR_STATES = Object.freeze(['open', 'merged', 'closed']);
export const CONTRACT_STATUSES = Object.freeze(['READY_FOR_MERGE', 'HOLD', 'BLOCKED']);
export const TASK_TYPES = Object.freeze(['single', 'multi-phase', 'aftercare']);
const FULL_SHA = /^[0-9a-f]{40}$/;
const TASK_ID = /^[a-z0-9][a-z0-9-]*$/;

/** Erlaubte Phasenwechsel; derselbe Zustand ist ein erneuter Lauf, kein Wechsel. */
export const PHASE_TRANSITIONS = Object.freeze({
  READY: ['READY', 'IMPLEMENTING', 'CI_PENDING'],
  IMPLEMENTING: ['IMPLEMENTING', 'READY', 'CI_PENDING'],
  CI_PENDING: ['CI_PENDING', 'IMPLEMENTING', 'MERGE_PENDING'],
  MERGE_PENDING: ['MERGE_PENDING', 'CI_PENDING', 'IMPLEMENTING', 'AFTERCARE'],
  AFTERCARE: ['AFTERCARE', 'IMPLEMENTING', 'MERGE_PENDING', 'DONE'],
  DONE: ['DONE'],
});

export function canTransition(from, to) {
  return (PHASE_TRANSITIONS[String(from ?? '')] ?? []).includes(String(to ?? ''));
}

/** Dateiname-Slug eines Claims; stabil und ohne Sonderzeichen. */
export function taskIdForClaim(claim) {
  const explicit = String(claim?.taskId ?? '').trim();
  if (TASK_ID.test(explicit)) return explicit;
  const id = String(claim?.id ?? '').trim().replace(/^lane\//, '');
  return id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'task';
}

export function contractRelativePath(taskId) {
  return `${TASK_DIR}${taskId}.json`;
}

/** Ein Vertrag aus Claim und Startphase; ohne Zeitstempel, damit er deterministisch bleibt. */
export function makeTaskContract(claim, { phase = 'READY', baseSha = '', nextAction = 'Arbeit starten und turn:finish ohne Flags ausfuehren; CI prueft.' } = {}) {
  const taskId = taskIdForClaim(claim);
  return {
    version: 1,
    taskId,
    claimId: claim?.id ?? null,
    branch: claim?.branch ?? '',
    baseSha: String(baseSha || claim?.baseSha || ''),
    phase,
    title: String(claim?.task ?? '').trim() || taskId,
    goal: String(claim?.goal ?? '').trim(),
    taskType: 'single',
    holdMerge: false,
    status: 'READY_FOR_MERGE',
    pr: null,
    findings: [],
    nextAction,
    revision: 1,
  };
}

/** Parst eine Vertragsdatei; Fehler werden als Befund zurueckgegeben, nie still. */
export function readTaskContractFile(file) {
  try {
    return { contract: JSON.parse(readFileSync(file, 'utf8')), error: null };
  } catch (error) {
    return { contract: null, error: `Task-Vertrag nicht lesbar (${file}): ${String(error?.message ?? error).slice(0, 160)}` };
  }
}

/**
 * Vertrag eines Claims: zuerst der erwartete Dateiname, dann eine Suche nach
 * `claimId`, damit ein umbenannter Task seinen alten Vertrag nicht verliert.
 * Mehrere Treffer sind ein Befund, kein stilles Auswaehlen.
 */
export function loadTaskContractForClaim(claim, { root = ROOT } = {}) {
  const taskId = taskIdForClaim(claim);
  const expected = contractRelativePath(taskId);
  const file = join(root, expected);
  if (existsSync(file)) {
    const { contract, error } = readTaskContractFile(file);
    return { contract, file: expected, error };
  }
  const hits = [];
  const dir = join(root, TASK_DIR);
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json')).sort()) {
      const relative = `${TASK_DIR}${name}`;
      const parsed = readTaskContractFile(join(root, relative));
      if (parsed.contract?.claimId === claim?.id) hits.push({ contract: parsed.contract, file: relative });
    }
  }
  if (hits.length > 1) {
    return { contract: null, file: expected, error: `Mehrere Task-Vertraege fuer '${claim?.id}': ${hits.map((hit) => hit.file).join(', ')}` };
  }
  if (hits.length === 1) return { ...hits[0], error: null };
  return { contract: null, file: expected, error: null };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Die einzige Validierung. Jede Aufrufstelle reicht ihren Claim und den
 * bisherigen Vertrag mit; `previous` aktiviert die Phasenpruefung.
 */
export function validateTaskContract(contract, { claim = null, branch = '', previous = null, enforceTransition = true } = {}) {
  const violations = [];
  if (!isObject(contract)) return { ok: false, violations: ['Task-Vertrag ist kein Objekt'] };
  if (contract.version !== 1) violations.push(`unbekannte Vertragsversion ${String(contract.version)}`);
  if (!TASK_ID.test(String(contract.taskId ?? ''))) violations.push('taskId fehlt oder folgt nicht dem Slug-Schema');
  if (!String(contract.claimId ?? '').trim()) violations.push('claimId fehlt');
  if (!String(contract.branch ?? '').trim()) violations.push('branch fehlt');
  if (claim) {
    if (contract.claimId !== claim.id) violations.push(`claimId '${String(contract.claimId)}' passt nicht zu '${claim.id}'`);
    if (contract.branch !== claim.branch) violations.push(`branch '${String(contract.branch)}' passt nicht zu '${claim.branch}'`);
  }
  if (branch && contract.branch !== branch) violations.push(`branch '${String(contract.branch)}' passt nicht zum Lauf '${branch}'`);
  if (!FULL_SHA.test(String(contract.baseSha ?? ''))) violations.push('baseSha ist kein vollstaendiger Commit');
  if (!TASK_PHASES.includes(contract.phase)) violations.push(`Phase '${String(contract.phase)}' ist unbekannt`);
  if (!String(contract.title ?? '').trim()) violations.push('title fehlt');
  if (typeof contract.goal !== 'string') violations.push('goal ist kein Text');
  if (contract.taskType !== undefined && !TASK_TYPES.includes(contract.taskType)) {
    violations.push(`taskType '${String(contract.taskType)}' ist unbekannt`);
  }
  if (contract.holdMerge !== undefined && typeof contract.holdMerge !== 'boolean') {
    violations.push('holdMerge ist kein Boolean');
  }
  if (contract.status !== undefined && !CONTRACT_STATUSES.includes(contract.status)) {
    violations.push(`status '${String(contract.status)}' ist unbekannt`);
  }
  if (!Number.isInteger(contract.revision) || contract.revision < 1) violations.push('revision ist keine positive Ganzzahl');
  if (contract.phase !== 'DONE' && !String(contract.nextAction ?? '').trim()) violations.push('nextAction fehlt');

  if (contract.pr !== null && contract.pr !== undefined) {
    if (!isObject(contract.pr)) violations.push('pr ist weder null noch ein Objekt');
    else {
      if (!Number.isInteger(contract.pr.number) || contract.pr.number <= 0) violations.push('pr.number ist keine positive Ganzzahl');
      if (!String(contract.pr.url ?? '').trim()) violations.push('pr.url fehlt');
      if (!PR_STATES.includes(contract.pr.state)) violations.push(`pr.state '${String(contract.pr.state)}' ist unbekannt`);
    }
  }

  if (!Array.isArray(contract.findings)) {
    violations.push('findings ist keine Liste');
  } else {
    const seen = new Set();
    for (const finding of contract.findings) {
      if (!isObject(finding)) {
        violations.push('finding ist kein Objekt');
        continue;
      }
      const id = String(finding.id ?? '').trim();
      if (!id) violations.push('finding.id fehlt');
      else if (seen.has(id)) violations.push(`finding.id '${id}' ist doppelt`);
      seen.add(id);
      if (!FINDING_STATUSES.includes(finding.status)) violations.push(`finding ${id || '(ohne id)'}: status '${String(finding.status)}' ist unbekannt`);
      if (!FINDING_SEVERITIES.includes(finding.severity)) violations.push(`finding ${id || '(ohne id)'}: severity '${String(finding.severity)}' ist unbekannt`);
      if (!String(finding.summary ?? '').trim()) violations.push(`finding ${id || '(ohne id)'}: summary fehlt`);
    }
  }

  if (previous && enforceTransition && previous.phase !== contract.phase && !canTransition(previous.phase, contract.phase)) {
    violations.push(`Phasenwechsel ${previous.phase} -> ${contract.phase} ist nicht erlaubt`);
  }
  return { ok: violations.length === 0, violations };
}

/** Neuer Vertrag mit erzwungenem Phasenwechsel; `previous` ist der Commit-Stand. */
export function transitionTaskContract(contract, toPhase, patch = {}, { previous = contract } = {}) {
  const next = {
    ...contract,
    ...patch,
    phase: toPhase,
    revision: (Number.isInteger(contract?.revision) ? contract.revision : 0) + 1,
  };
  const validation = validateTaskContract(next, { previous });
  return { ok: validation.ok, contract: next, violations: validation.violations };
}

export function openFindings(contract) {
  return (contract?.findings ?? []).filter((finding) => finding.status === 'open');
}

export function blockerFindings(contract) {
  return openFindings(contract).filter((finding) => finding.severity === 'blocker');
}

/** Ein Befund wird ergaenzt oder in seinem Status fortgeschrieben. */
export function upsertFinding(contract, finding) {
  const findings = [...(contract?.findings ?? [])];
  const index = findings.findIndex((entry) => entry.id === finding.id);
  if (index >= 0) findings[index] = { ...findings[index], ...finding };
  else findings.push(finding);
  return { ...contract, findings };
}

/** Gibt es fuer den PR-Kopf einen vollstaendigen gruenen Pflichtstatus? */
export function readCiState({ branch, ghBin = process.env.RBD_GH_BIN || 'gh', root = ROOT } = {}) {
  if (!branch) return { known: false, complete: false, conclusion: null, name: 'Fail-Closed Gates' };
  try {
    // Ein Aufruf: der CI-State-Kommentar ist die erste Quelle, der Check-Rollup
    // bleibt nur der Fallback fuer Legacy-PRs ohne Kommentar. Der Kommentar
    // zaehlt nur, wenn er zum aktuellen PR-Kopf gehoert.
    const output = execFileSync(
      ghBin,
      ['pr', 'view', branch, '--json', 'number,headRefOid,comments,statusCheckRollup'],
      { cwd: root, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const data = JSON.parse(output);
    const comment = latestCiState(data?.comments ?? []);
    if (comment && comment.headSha === data?.headRefOid) {
      return {
        ...readCiStateResult(comment),
        name: comment.state === 'HOLD' ? 'Fail-Closed Gates' : 'rbd:ci-state',
        url: null,
        prNumber: data?.number ?? null,
      };
    }
    const rollup = data?.statusCheckRollup ?? [];
    const required = rollup.find((check) => check.name === 'Fail-Closed Gates' || check.context === 'Fail-Closed Gates') ?? null;
    if (!required) return { known: true, complete: false, conclusion: null, name: 'Fail-Closed Gates' };
    const status = String(required.status ?? required.state ?? '').toLowerCase();
    const conclusion = String(required.conclusion ?? '').toLowerCase() || null;
    return {
      known: true,
      complete: status === 'completed' || status === 'success' || status === 'failure',
      conclusion: conclusion ?? (status === 'success' ? 'success' : status === 'failure' ? 'failure' : null),
      name: 'Fail-Closed Gates',
      url: required.detailsUrl ?? required.targetUrl ?? null,
      prNumber: data?.number ?? null,
    };
  } catch {
    return { known: false, complete: false, conclusion: null, name: 'Fail-Closed Gates' };
  }
}

/** PR-Zustand aus GitHub; ohne `gh` bleibt er `unknown` und blockiert nie. */
export function readPullRequestState({ branch, ghBin = process.env.RBD_GH_BIN || 'gh', root = ROOT } = {}) {
  if (!branch) return { known: false, error: 'kein Branch' };
  try {
    const output = execFileSync(
      ghBin,
      ['pr', 'view', branch, '--json', 'number,url,state,isDraft,headRefOid,baseRefName,mergedAt'],
      { cwd: root, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const data = JSON.parse(output);
    return {
      known: true,
      number: data.number ?? null,
      url: data.url ?? null,
      state: String(data.state ?? '').toLowerCase() || 'open',
      draft: Boolean(data.isDraft),
      headSha: data.headRefOid ?? null,
      base: data.baseRefName ?? null,
      merged: Boolean(data.mergedAt) || String(data.state).toUpperCase() === 'MERGED',
    };
  } catch {
    return { known: false, error: 'PR-Zustand nicht lesbar (gh fehlt oder ist nicht angemeldet)' };
  }
}

/**
 * Leitet den pretask-Status ab. `CI_PENDING` schlaegt eine parallele Lane vor,
 * statt zu warten; ein gemergter PR fuehrt in die Nachsorge.
 */
export function deriveTaskState({ contract = null, claim = null, blockers = [], pr = null, ci = null } = {}) {
  const findings = openFindings(contract);
  const base = {
    status: 'CONTINUE',
    phase: contract?.phase ?? 'READY',
    nextAction: contract?.nextAction ?? 'Task-Vertrag anlegen: pnpm run task:contract --init',
    findings,
    parallelLane: null,
  };
  if (blockers.length > 0) {
    return { ...base, status: 'BLOCKED', nextAction: `Blockers aufloesen: ${blockers[0]}` };
  }
  if (!contract) {
    return { ...base, status: 'READY', phase: 'READY', nextAction: `Task-Vertrag anlegen (${claim?.id ?? 'Lane'}): pnpm run task:contract --init` };
  }
  if (pr?.merged || contract.phase === 'DONE') {
    return {
      ...base,
      status: 'AFTERCARE',
      phase: 'DONE',
      nextAction: contract.phase === 'DONE' ? 'Abgeschlossen; neue Arbeit als neue Lane starten.' : 'Nachsorge abschliessen und den Vertrag auf DONE setzen.',
    };
  }
  if (ci?.state === 'HOLD') {
    return { ...base, status: 'CONTINUE', nextAction: ci.nextAction || 'Hold: Merge ist gesperrt; Vertrag oder Blocker pruefen.' };
  }
  if (ci?.state === 'REMOTE_CI') {
    return { ...base, status: 'CONTINUE', nextAction: ci.nextAction || 'REMOTE_CI: CI erneut starten; kein BLOCKED.' };
  }
  if (ci?.state === 'SUPERSEDED') {
    return { ...base, status: 'CONTINUE', nextAction: ci.nextAction || 'Ein neuerer Lauf ist die Autoritaet; diesen Zustand nicht als Merge-Beleg verwenden.' };
  }
  if (contract.phase === 'CI_PENDING') {
    if (ci?.known && ci.complete && ci.conclusion === 'success') {
      return { ...base, status: 'MERGE_PENDING', nextAction: 'PR-Lauf gruen: Plan-Artefakt, Pflichtstatus und Hold pruefen; Merge nur durch promote auf dem exakten Kopf.' };
    }
    if (ci?.known && ci.complete && ci.conclusion === 'failure') {
      return { ...base, status: 'CONTINUE', nextAction: 'PR-Lauf rot: Befund in den Vertrag aufnehmen, beheben und turn:finish erneut ausfuehren.' };
    }
    return {
      ...base,
      status: 'CONTINUE',
      nextAction: 'CI laeuft; nicht warten, sondern eine unabhaengige parallele Lane starten oder Befunde triagieren.',
      parallelLane: {
        suggested: true,
        reason: 'CI_PENDING',
        advice: 'Parallele Lane mit eigener Allowlist und eigenem Task-Vertrag anlegen; der PR-Lauf meldet sich, kein Polling.',
      },
    };
  }
  if (contract.phase === 'MERGE_PENDING') {
    return { ...base, status: 'MERGE_PENDING', nextAction: contract.nextAction || 'Merge auf dem exakten Kopf; danach Nachsorge.' };
  }
  if (contract.phase === 'AFTERCARE') {
    return { ...base, status: 'AFTERCARE', nextAction: contract.nextAction || 'Nachsorge abschliessen und den Vertrag auf DONE setzen.' };
  }
  if (contract.phase === 'READY') {
    return { ...base, status: 'READY', nextAction: contract.nextAction || 'Erste Aenderung innerhalb der Allowlist beginnen.' };
  }
  return base;
}

/** Vertrag an einer Git-Ref (PR-Kopf) fuer `promote`; ohne Treffer `null`. */
export function readTaskContractAtRef(ref, { branch = '', root = ROOT } = {}) {
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let names;
  try {
    names = git(['ls-tree', '-r', '--name-only', ref, '--', TASK_DIR]).split(/\r?\n/).filter((name) => name.endsWith('.json'));
  } catch {
    return null;
  }
  for (const name of names) {
    try {
      const contract = JSON.parse(git(['show', `${ref}:${name}`]));
      if (branch && contract?.branch !== branch) continue;
      return { contract, file: name };
    } catch {
      // Ein unlesbarer Vertrag ist kein Treffer; der Aufrufer entscheidet fail-closed.
    }
  }
  return null;
}

/** Atomar schreiben; der Vertrag ist Teil des Commits, kein Cache. */
export function writeTaskContract(file, contract, { root = ROOT } = {}) {
  const full = join(root, file);
  const temp = `${full}.new`;
  writeFileSync(temp, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  renameSync(temp, full);
  return contract;
}
