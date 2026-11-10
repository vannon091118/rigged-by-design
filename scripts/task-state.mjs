#!/usr/bin/env node
/**
 * Task-Zustand: nach dem Turn ist vor dem naechsten.
 *
 * `.verify-cache/after-task.json` beschreibt den abgeschlossenen lokalen Turn
 * (Branch, HEAD, Basis, Claim, eigene/fremde Pfade, Tests, Gate-Ergebnis,
 * naechste Schritte). `task:pause` friert ihn ein, `pretask --resume` prueft
 * Claim, Branch, Worktree und WIP erneut, `task:complete` akzeptiert nur einen
 * gruenen CI-Run fuer exakt denselben SHA.
 *
 * Es gibt keine History-Umschreibung und keinen Force-Pfad: der Zustand ist
 * eine Datei, kein Git-Eingriff.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scopeChanges } from './lib/staging-scope.mjs';
import { ROOT } from './lib/report.mjs';

export const AFTER_TASK_FILE = '.verify-cache/after-task.json';
export const TASK_STATE_FILE = '.verify-cache/task-state.json';
export const AFTER_TASK_STATES = Object.freeze(['TESTS_PASSED', 'CI_PENDING']);
export const TASK_PAUSED = 'TASK_PAUSED';
export const TASK_COMPLETE = 'TASK_COMPLETE';

const FULL_SHA = /^[0-9a-f]{40}$/;
// Ein Prozesszaehler statt jeder Uhr: das Governance-Lint verbietet
// Kalender- und Wall-Clock-Zeit; ein monotoner Zaehler genuegt dem Zustand.
let clock = 0; const now = () => String(++clock);
const afterTaskPath = (root) => join(root, AFTER_TASK_FILE);

/**
 * Nach dem lokalen Turn ist der Baum geprueft, aber noch nicht auf dem Remote:
 * TESTS_PASSED. Nach dem Push wartet CI: CI_PENDING. Ein rotes Gate erzeugt
 * keinen Erfolgszustand.
 */
export function afterTaskState({ gateOk, pushed = false } = {}) {
  if (gateOk !== true) return null;
  return pushed ? 'CI_PENDING' : 'TESTS_PASSED';
}

/** Der vollstaendige Datensatz; Pflichtfelder fehlen nie stillschweigend. */
export function afterTaskRecord({
  branch,
  head,
  base = '',
  claim = null,
  own = [],
  foreign = [],
  tests = {},
  gate = {},
  next = [],
  state,
} = {}) {
  if (!branch) throw new Error('after-task braucht einen Branch');
  if (!FULL_SHA.test(String(head ?? ''))) throw new Error('after-task braucht den vollen HEAD-Commit');
  if (!AFTER_TASK_STATES.includes(state)) throw new Error(`after-task: Zustand '${state}' ist unbekannt`);
  if (gate.ok === false) throw new Error('after-task: ein rotes Gate erzeugt keinen Erfolgszustand');
  return {
    version: 1,
    state,
    branch,
    head,
    base,
    claim: claim ? { id: claim.id, owner: claim.owner ?? null, branch: claim.branch ?? branch } : null,
    paths: { own: [...own], foreign: [...foreign] },
    tests: {
      profile: 'light',
      script: 'verify:light',
      affected: false,
      delegated: [],
      ...tests,
    },
    gate: { ok: true, profile: 'light', script: 'verify:light', ...gate },
    next: [...next],
    updatedAt: now(),
  };
}

export function readAfterTask({ root = ROOT } = {}) {
  try {
    return JSON.parse(readFileSync(afterTaskPath(root), 'utf8'));
  } catch {
    return null;
  }
}

/** Atomar schreiben und verschachtelte Bereiche erhalten. */
export function writeAfterTask(patch, { root = ROOT } = {}) {
  const previous = readAfterTask({ root }) ?? {};
  const merged = {
    ...previous,
    ...patch,
    paths: { ...(previous.paths ?? {}), ...(patch.paths ?? {}) },
    tests: { ...(previous.tests ?? {}), ...(patch.tests ?? {}) },
    gate: { ...(previous.gate ?? {}), ...(patch.gate ?? {}) },
    updatedAt: now(),
  };
  const file = afterTaskPath(root);
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.new`;
  writeFileSync(temp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  renameSync(temp, file);
  return merged;
}

const defaultGit = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Pausiert den Turn; ohne Vorzustand wird ein minimaler Datensatz angelegt. */
export function pauseTask({ reason = 'manuell pausiert', root = ROOT, git = defaultGit } = {}) {
  const previous = readAfterTask({ root }) ?? {
    version: 1,
    state: 'TESTS_PASSED',
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    head: git(['rev-parse', 'HEAD']),
    base: '',
    claim: null,
    paths: { own: [], foreign: [] },
    tests: {},
    gate: { ok: true },
    next: [],
  };
  return writeAfterTask(
    {
      ...previous,
      state: TASK_PAUSED,
      previousState: previous.state === TASK_PAUSED ? previous.previousState : previous.state,
      pausedAt: now(),
      reason,
    },
    { root },
  );
}

/**
 * Resume nur mit eigenem Claim im verknuepften Worktree und ohne fremde WIP.
 * Ohne after-task-Datensatz bleibt der bisherige Pretask-Weg unveraendert.
 */
export function resumeDecision({
  record = readAfterTask(),
  branch = '',
  claim = null,
  isWorktree = false,
  dirtyPaths = [],
} = {}) {
  if (!record) return { ok: true, state: null, reasons: [], noRecord: true };
  const reasons = [];
  if (record.state !== TASK_PAUSED) reasons.push(`Zustand ${record.state} ist nicht pausiert`);
  if (record.branch && record.branch !== branch) reasons.push(`Branch ${branch} passt nicht zu ${record.branch}`);
  if (!claim) reasons.push('kein Claim fuer den Branch');
  else if (claim.branch !== branch) reasons.push(`Claim gehoert zu ${claim.branch}`);
  if (!isWorktree) reasons.push('kein verknuepfter Worktree');
  const scope = scopeChanges({ changed: dirtyPaths, allowlist: claim?.pathAllowlist ?? [] });
  if (scope.foreign.length > 0) reasons.push(`fremde WIP: ${scope.foreign.slice(0, 5).join(', ')}`);
  return {
    ok: reasons.length === 0,
    state: record.previousState ?? 'TESTS_PASSED',
    reasons,
  };
}

/** Stellt den Zustand vor der Pause wieder her; `null` heisst: nichts zu tun. */
export function resumeTask(input = {}) {
  const decision = resumeDecision(input);
  if (!decision.ok || !decision.state) return decision;
  writeAfterTask({ state: decision.state, resumedAt: now(), pausedAt: null, reason: null }, { root: input.root ?? ROOT });
  return decision;
}

/** Nur ein abgeschlossener, gruener Run fuer exakt denselben SHA zaehlt. */
export function completeDecision({ record, headSha, run } = {}) {
  const reasons = [];
  if (!record) reasons.push('kein after-task-Zustand');
  if (!FULL_SHA.test(String(headSha ?? ''))) reasons.push('HEAD ist kein voller Commit');
  if (record && record.head !== headSha) {
    reasons.push(`HEAD ${String(headSha).slice(0, 7)} ist nicht der gepruefte ${String(record.head).slice(0, 7)}`);
  }
  if (!run) reasons.push('kein CI-Run angegeben');
  else {
    if (run.headSha !== headSha) reasons.push(`Run ${String(run.headSha).slice(0, 7)} gehoert nicht zu ${String(headSha).slice(0, 7)}`);
    if (run.status !== 'completed') reasons.push(`Run ist ${run.status ?? 'unbekannt'}, nicht completed`);
    if (run.conclusion !== 'success') reasons.push(`Run ist ${run.conclusion ?? 'unbekannt'}, nicht success`);
  }
  return { ok: reasons.length === 0, reasons };
}

const defaultGh = (args) =>
  execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

export function completeTask({ runId, root = ROOT, gh = defaultGh, git = defaultGit } = {}) {
  if (!runId) return { ok: false, reasons: ['--run <id> fehlt'] };
  const record = readAfterTask({ root });
  const headSha = git(['rev-parse', 'HEAD']);
  let run;
  try {
    run = JSON.parse(gh(['run', 'view', String(runId), '--json', 'headSha,status,conclusion,url,workflowName']));
  } catch (error) {
    return { ok: false, reasons: [`Run ${runId} nicht lesbar: ${String(error?.message ?? error).slice(0, 120)}`] };
  }
  const decision = completeDecision({ record, headSha, run });
  if (!decision.ok) return { ok: false, reasons: decision.reasons };
  const next = writeAfterTask(
    {
      state: TASK_COMPLETE,
      completedAt: now(),
      run: { id: Number(runId), url: run.url ?? null, conclusion: run.conclusion, headSha: run.headSha },
      next: ['PR gegen main anlegen; Merge nur durch promote nach gruenem PR-Lauf'],
    },
    { root },
  );
  return { ok: true, record: next };
}

export function statusReport({ root = ROOT } = {}) {
  const afterTask = readAfterTask({ root });
  let pretask = null;
  try {
    pretask = JSON.parse(readFileSync(join(root, TASK_STATE_FILE), 'utf8'));
  } catch {
    // Noch kein Pretask-Lauf ist ein gueltiger Zustand.
  }
  return { state: afterTask?.state ?? pretask?.state ?? 'UNBEKANNT', afterTask, pretask };
}

function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? 'status';
  const asJson = argv.includes('--json');
  const value = (name) => {
    const hit = argv.find((entry) => entry.startsWith(`--${name}=`));
    if (hit) return hit.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    const next = index >= 0 ? argv[index + 1] : '';
    return next && !next.startsWith('--') ? next : '';
  };

  if (command === 'status') {
    const report = statusReport();
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      return 0;
    }
    console.log(`task:status: ${report.state}`);
    if (report.afterTask) {
      console.log(`  Branch ${report.afterTask.branch} · HEAD ${String(report.afterTask.head).slice(0, 7)} · Basis ${String(report.afterTask.base ?? '').slice(0, 7) || '-'}`);
      console.log(`  Pfade eigen=${report.afterTask.paths?.own?.length ?? 0} fremd=${report.afterTask.paths?.foreign?.length ?? 0}`);
      for (const step of report.afterTask.next ?? []) console.log(`  -> ${step}`);
    } else {
      console.log('  kein after-task-Zustand; turn:finish schreibt ihn.');
    }
    if (report.pretask) console.log(`  pretask: ${report.pretask.state} (${report.pretask.branch})`);
    return 0;
  }

  if (command === 'pause') {
    const record = pauseTask({ reason: value('reason') || 'manuell pausiert' });
    console.log(`task:pause: ${record.state} · ${record.branch} · ${String(record.head).slice(0, 7)}`);
    return 0;
  }

  if (command === 'complete') {
    const result = completeTask({ runId: value('run') });
    if (!result.ok) {
      console.error(`task:complete verweigert: ${result.reasons.join('; ')}`);
      return 1;
    }
    console.log(`task:complete: ${result.record.state} fuer ${String(result.record.head).slice(0, 7)}`);
    return 0;
  }

  console.error(`task-state: unbekannter Befehl '${command}' (status, pause, complete)`);
  return 1;
}

const entrypoint = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
if (entrypoint) {
  process.exit(main());
}
