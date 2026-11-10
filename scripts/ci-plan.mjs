#!/usr/bin/env node
/**
 * CI-Plan fuer GitHub Actions: der Zustand des Laufs entscheidet, welche Gates
 * und Tests laufen.
 *
 * Aufruf:
 *   node scripts/ci-plan.mjs --event=<ereignis> [--base=<sha>] [--head=<sha>]
 *        [--noop] [--handoff] [--required=<gate,gate>]
 *        [--github-output=<datei>] [--json=1]
 *
 * Verhalten:
 * - `state` ist die eine Entscheidung: PR, MAIN, MANUAL, LIGHT, NOOP,
 *   PR_HANDOFF oder UNKNOWN. Gates, Required-Set und Tests folgen daraus.
 * - Eine leere Matrix ist nur fuer NOOP und PR_HANDOFF zulaessig. Jeder andere
 *   Zustand traegt das Required-Set; UNKNOWN faellt nie auf eine leere Matrix
 *   zurueck, sondern auf das volle Profil.
 * - `--required` pinnt das Required-Set (Tests, Sonderlaeufe). Ein unbekanntes
 *   Gate ist ein Fehler, kein stiller Zusatz.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildPlan, planForCI, planReport } from './lib/ci-plan.mjs';
import { GATES } from './lib/pipeline-plan.mjs';
import { ROOT } from './lib/report.mjs';

const args = process.argv.slice(2);
const arg = (name) => {
  const hit = args.find((value) => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  // Auch die Schreibweise `--flag wert` akzeptieren: ein Leerzeichen statt `=`
  // hat die Matrix schon einmal leer gelassen und den Plan-Job gekippt.
  const index = args.indexOf(`--${name}`);
  const next = index >= 0 ? args[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
};
const bool = (name) => {
  const raw = arg(name);
  if (raw !== undefined) return ['1', 'true', 'yes'].includes(raw.toLowerCase());
  return args.includes(`--${name}`);
};
const stop = (message) => {
  console.error(`ci-plan: ${message}`);
  process.exit(1);
};

const base = arg('base') ?? '';
const head = arg('head') ?? '';
const event = arg('event') ?? '';
const ref = arg('ref') ?? '';
const noopFlag = bool('noop');
const handoff = bool('handoff') || event.toLowerCase() === 'pr-handoff';
const required = (arg('required') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (required.length > 0) {
  const unknown = required.filter((key) => !GATES[key]);
  if (unknown.length > 0) {
    stop(`unbekannte Required-Gates: ${unknown.join(', ')}; bekannt sind ${Object.keys(GATES).join(', ')}`);
  }
}
const outputFile = arg('github-output');
const reportPath = resolve(ROOT, process.env.CI_PLAN_PATH ?? '.verify-cache/ci-plan.json');

// Ein manueller Lauf ist auch ohne Diff ein bekannter Zustand. Ein unbekanntes
// Ereignis oder ein nicht lesbarer Diff bleibt dagegen UNKNOWN und damit das
// volle Profil: fail-closed statt scheinbar leicht.
const forced = handoff
  ? 'PR_HANDOFF'
  : noopFlag
    ? 'NOOP'
    : event.toLowerCase() === 'workflow_dispatch'
      ? 'MANUAL'
      : null;
const options = { base, head, event, ref, noop: noopFlag, handoff, required };
const result = planForCI({ ...options, state: forced ?? undefined });
const plan = result?.plan ?? buildPlan([], { ...options, state: forced ?? 'UNKNOWN' });

// Task-Vertrag: der Plan prueft denselben Vertrag wie pretask und turn:finish.
// Der Import ist dynamisch, damit die Kontrollebene aus der Basis ohne diese
// Datei weiterlaeuft; fehlt sie, bleibt der Schritt inert.
const taskContractMod = await import('./lib/task-contract.mjs').catch(() => null);
if (taskContractMod) {
  const { loadClaimsStrict, selectClaim } = await import('./lib/lane-claims.mjs');
  const branchName = ref.replace(/^refs\/heads\//, '');
  const claims = loadClaimsStrict();
  const claim = selectClaim(claims, branchName);
  if (claim) {
    const loaded = taskContractMod.loadTaskContractForClaim(claim);
    if (loaded.error) stop(`Task-Vertrag: ${loaded.error}`);
    if (loaded.contract) {
      const check = taskContractMod.validateTaskContract(loaded.contract, { claim, branch: branchName });
      if (!check.ok) stop(`Task-Vertrag ungueltig: ${check.violations.join('; ')}`);
    }
  }
}

const gates = plan.gateKeys;
const state = plan.state;
const mayBeEmpty = state === 'NOOP' || state === 'PR_HANDOFF';
if (gates.length === 0 && !mayBeEmpty) {
  stop(`Zustand ${state} ohne Gate; eine leere Matrix waere hier ein Freischein`);
}
if (gates.length > 0 && mayBeEmpty) {
  stop(`Zustand ${state} traegt Gates (${gates.join(', ')}); ein No-op prueft nichts`);
}
const missing = plan.required.filter((key) => !gates.includes(key));
if (missing.length > 0) {
  stop(`Required-Gates fehlen in der Matrix: ${missing.join(', ')}`);
}

const matrix = JSON.stringify({ include: gates.map((gate) => ({ gate })) });
const testFiles = plan.tests.runAll ? '' : plan.tests.files.join(',');
const longFiles = plan.tests.long ?? [];
// Ein leerer `include`-Block ist fuer GitHub keine gueltige Matrix. Der
// Sentinel haelt den Ausdruck parsebar; der Job selbst bleibt per `if` aus.
const longMatrix = JSON.stringify({ include: (longFiles.length > 0 ? longFiles : ['']).map((file) => ({ file })) });
const profile = state === 'LIGHT' ? 'light' : mayBeEmpty ? 'none' : 'full';
const report = planReport(result?.changed ?? [], plan);

const lines = [
  `### CI-Plan: ${state}`,
  '',
  `Basis: \`${base || '-'}\` · Kopf: \`${head || '-'}\` · Ereignis: \`${event || '-'}\` · Ref: \`${ref || '-'}\``,
  '',
  '| Feld | Wert |',
  '| --- | --- |',
  `| Zustand | \`${state}\` |`,
  `| Lauf | ${plan.run ? 'ja' : 'nein'} |`,
  `| Geaenderte Dateien | ${result?.changed.length ?? 0} |`,
  `| Required | ${plan.required.join(', ') || 'keine'} |`,
  `| Gates (Matrix) | ${gates.join(', ') || 'keine'} |`,
  `| Tests | ${plan.tests.runAll ? 'vollstaendig' : `${plan.tests.files.length} ausgewaehlt`} (${plan.tests.reason}) |`,
  `| Lange Nachweise | ${longFiles.length > 0 ? longFiles.join(', ') : 'keine'} |`,
  `| Shards | ${plan.tests.shards.length || 1} |`,
  `| Advisory | ${plan.advisory.join(', ') || 'keine'} |`,
];
if (plan.skipped.length > 0) {
  lines.push('', 'Ausgelassen:', ...plan.skipped.map((entry) => `- \`${entry.gate}\`: ${entry.reason}`));
}
const summary = `${lines.join('\n')}\n`;

try {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
} catch {
  // Der Bericht ist Komfort; die Matrix haengt nicht daran.
}
if (outputFile) {
  appendFileSync(outputFile, `state=${state}\n`);
  appendFileSync(outputFile, `run=${plan.run}\n`);
  appendFileSync(outputFile, `noop=${plan.noop}\n`);
  appendFileSync(outputFile, `required=${plan.required.join(',')}\n`);
  appendFileSync(outputFile, `profile=${profile}\n`);
  appendFileSync(outputFile, `matrix=${matrix}\n`);
  appendFileSync(outputFile, `test_files=${testFiles}\n`);
  appendFileSync(outputFile, `tests_json=${JSON.stringify(plan.tests)}\n`);
  appendFileSync(outputFile, `long_count=${longFiles.length}\n`);
  appendFileSync(outputFile, `long_matrix=${longMatrix}\n`);
  appendFileSync(outputFile, `long_tests=${longFiles.join(',')}\n`);
  appendFileSync(outputFile, `plan_reason=${plan.reason}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (arg('json') === '1') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else process.stdout.write(`${matrix}\n`);
console.error(summary);
