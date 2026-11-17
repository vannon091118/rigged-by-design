/**
 * Task-Vertrag: die eine Wahrheit eines Laufs.
 *
 * Der Vertrag liegt als `.lane-claims/tasks/<taskId>.json` im Branch und
 * beschreibt Phase, offene Befunde, PR-Zustand und die naechste Aktion. Er ist
 * kein Cache: `pretask`, `turn:finish`, `ci-plan` und `promote` lesen und
 * validieren ihn ueber dieselbe Funktion. Der Abschnitt `task` in
 * `.verify-cache/state.json` bleibt eine fluechtige Kopie fuer den lokalen Ablauf.
 *
 * Phasen:
 *   READY          Task beschrieben, noch kein lokaler Turn
 *   IMPLEMENTING   Arbeit laeuft, noch nicht gepusht
 *   CI_PENDING     gepusht; der lokale Vor-PR-Nachweis ist die Autoritaet
 *   MERGE_PENDING  lokal geprueft, Merge durch Mensch/Agent steht an
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
import { TASK_ID, validateTaskContract } from './task-contract-validate.mjs';

export {
  CLOSEOUT_KINDS, CONTRACT_STATUSES, FINDING_SEVERITIES, FINDING_STATUSES,
  PHASE_TRANSITIONS, PRETASK_STATUSES, PR_STATES, TASK_PHASES, TASK_TYPES,
  canTransition, validateTaskContract,
} from './task-contract-validate.mjs';
export { readCiState, readPullRequestState } from './task-contract-remote.mjs';
export { blockerFindings, deriveTaskState, openFindings } from './task-contract-state.mjs';

export const TASK_DIR = TASK_CONTRACT_PREFIX;
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
export function makeTaskContract(claim, { phase = 'READY', baseSha = '', nextAction = 'Arbeit starten und turn:finish ohne Flags ausfuehren; der lokale Vor-PR-Nachweis entscheidet.' } = {}) {
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
 * Alle Task-Vertraege des Arbeitsbaums. Der Dateiname bleibt relativ zum
 * Repository, damit Retention und Closeout ihn direkt stagen koennen.
 */
export function loadTaskContracts({ root = ROOT } = {}) {
  const dir = join(root, TASK_DIR);
  const tasks = [];
  const errors = [];
  if (!existsSync(dir)) return { tasks, errors };
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json')).sort()) {
    const file = `${TASK_DIR}${name}`;
    const { contract, error } = readTaskContractFile(join(root, file));
    if (error) {
      errors.push(error);
      continue;
    }
    tasks.push({ file, contract });
  }
  return { tasks, errors };
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

/** Ein Befund wird ergaenzt oder in seinem Status fortgeschrieben. */
export function upsertFinding(contract, finding) {
  const findings = [...(contract?.findings ?? [])];
  const index = findings.findIndex((entry) => entry.id === finding.id);
  if (index >= 0) findings[index] = { ...findings[index], ...finding };
  else findings.push(finding);
  return { ...contract, findings };
}
/**
 * Leitet den pretask-Status ab. `CI_PENDING` ist nur der gepushte Zustand;
 * der lokale Nachweis entscheidet, kein Warten auf CI. Ein gemergter PR fuehrt
 * in die Nachsorge.

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
