#!/usr/bin/env node
/**
 * Ein Ablauf statt drei: Impact bestimmen, Gates daraus planen, Cache nutzen,
 * einen Bericht schreiben. Nutzt `impact`, `pipeline-plan` und `gate-runner` —
 * es gibt keine zweite Pipeline und keinen zweiten Gate-Plan.
 *
 * `--profile=quick` laeuft die schnellen Gates und, wenn der Impact es erlaubt,
 * nur die betroffenen Tests. Diese Auswahl ist ausdruecklich Teilpruefung; der
 * Bericht nennt sie so. `--ci` delegiert die langen Nachweise an Actions.
 * `--plan` zeigt den Plan, ohne ein Gate zu starten.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { impact } from './lib/impact.mjs';
import { GATES, planGates } from './lib/pipeline-plan.mjs';
import { lastGateRows, runGates } from './lib/gate-runner.mjs';
import { openClaims } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
const PROFILE = profileArg ? profileArg.slice('--profile='.length) : 'quick';
const CI = argv.includes('--ci');
const DISPATCH_LONG = argv.includes('--dispatch-long');
const AS_JSON = argv.includes('--json');
const PLAN_ONLY = argv.includes('--plan');

const state = impact({ profile: PROFILE });

// Lane-Claim-Prüfung vor jedem Verify-Lauf: der aktive Branch muss einen
// gültigen Claim haben, sonst wird nicht geprüft (fail-closed).
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
};
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const claims = openClaims();
const claim = claims.find((c) => c.branch === branch);
if (!claim && !PLAN_ONLY) {
  console.error(`[ERR-4019] agent:verify: Branch '${branch}' hat keinen Lane-Claim in .lane-claims/claims.json`);
  console.error('  Registriere den Claim zuerst (siehe AGENTS.md § Lane- und Konflikt-Governance).');
  process.exit(1);
}
const steps = (planGates(PROFILE) ?? []).map((key) => ({ ...GATES[key] }));
const tests = steps.find((step) => step.name === 'tests');
let subset = [];
if (PROFILE === 'quick' && tests && !state.tests.runAll && state.tests.selected.length > 0) {
  subset = state.tests.selected;
  tests.env = { ...(tests.env ?? {}), RBD_TEST_FILES: subset.join(',') };
  // Eine Auswahl darf nie als Vollnachweis im Cache landen.
  tests.cache = false;
}
if (PROFILE === 'quick' && tests && state.tests.selected.length === 0 && !state.tests.runAll && state.tests.long.length === 0) {
  // Nichts geaendert heisst nicht "nichts pruefen": eine Verifikation ohne
  // Testlauf waere ein stiller Freischein. Ohne Auswahl laeuft die Suite.
  state.open.push('kein Testbezug im Diff: die Suite laeuft vollstaendig');
}

const header = `Verify ${PROFILE} · ${state.version} · ${state.tree.branch}@${state.tree.head} · Baum ${state.tree.key}`;
const width = Math.max(4, ...state.gates.map((gate) => gate.name.length));

if (PLAN_ONLY) {
  console.log(header);
  console.log(`Plan       ${state.gates.length} Gates · Tests ${subset.length > 0 ? `${subset.length} ausgewaehlt` : 'vollstaendig'}`);
  console.log('');
  console.log(`${'Gate'.padEnd(width)}  ${'Cache'.padEnd(5)}  Code`);
  for (const gate of state.gates) console.log(`${gate.name.padEnd(width)}  ${(gate.cached ? 'hit' : '-').padEnd(5)}  ${gate.code}`);
  process.exit(0);
}

// Keine Wanduhr: die Determinismus-Sperre gilt auch fuer Werkzeuge. Die
// Laufzeit kommt aus der monotonen Uhr, der Ablageort aus dem Pipeline-Lauf.
const startedAt = process.hrtime.bigint();
const failed = await runGates(steps);
const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

const report = {
  profile: PROFILE,
  partial: PROFILE === 'quick' && subset.length > 0,
  version: state.version,
  tree: state.tree,
  changed: state.changed,
  systems: state.systems,
  tests: { ...state.tests, executed: tests.skip ? [] : subset },
  gates: state.gates.map((gate) => ({
    ...gate,
    result: failed.includes(gate.name) ? 'failed' : gate.cached ? 'cached' : tests.skip && gate.name === 'tests' ? 'skipped' : 'executed',
  })),
  delegated: state.tests.long,
  durationMs,
  failed,
  open: [...state.open, ...(PROFILE === 'quick' ? ['Teilpruefung: die vollstaendige Suite und die Gates von full/release laufen in CI'] : [])],
};

const dir = process.env.RBD_VERIFY_REPORTS ?? join(ROOT, '.verify-cache', 'reports', 'agent');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'agent-summary.json'), `${JSON.stringify(report, null, 2)}\n`);

// `--ci` bedeutet: der PR-Plan übernimmt die langen Nachweise auf dem exakten
// Commit. Ein main-Dispatch aus dem lokalen Turn wäre weder derselbe Commit
// noch eine Delegation; der vollständige manuelle Lauf braucht --dispatch-long.
if (CI && report.delegated.length > 0) {
  report.ciLong = 'delegated-to-pr-plan';
  report.open.push(...report.delegated.map((entry) => `lang: ${entry.file} (${entry.proof}) — CI-Plan auf dem PR-Commit`));
  writeFileSync(join(dir, 'agent-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
}
if (DISPATCH_LONG && report.delegated.length > 0) {
  console.log(`agent:verify: ${report.delegated.length} lange Nachweis(e) manuell an Actions delegiert`);
  const run = spawnSync(process.execPath, ['scripts/ci-long-checks.mjs'], { cwd: ROOT, stdio: 'inherit' });
  report.ciLong = run.status === 0 ? 'success' : 'failed';
  writeFileSync(join(dir, 'agent-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const measured = new Map(lastGateRows().map((row) => [row.name, row]));
  const table = report.gates.map((gate) => {
    const row = measured.get(gate.name);
    const status = row ? row.status : gate.result === 'cached' ? 'cache' : gate.result === 'skipped' ? 'skip' : '-';
    return { name: gate.name, status, seconds: row ? row.seconds : '-' };
  });
  console.log(header);
  console.log(`Ergebnis   ${failed.length === 0 ? 'PASS' : 'ROT'} · ${report.gates.length} Gates · ${(durationMs / 1000).toFixed(1)}s`);
  console.log('');
  console.log(`${'Gate'.padEnd(width)}  ${'Status'.padEnd(6)}  Dauer`);
  for (const row of table) console.log(`${row.name.padEnd(width)}  ${row.status.padEnd(6)}  ${row.seconds}`);
  if (subset.length > 0) console.log(`Teilpruefung  ${subset.length} betroffene Testdatei(en), kein Vollnachweis`);
  if (report.delegated.length > 0) console.log(`Delegiert     ${report.delegated.length} lange Nachweis(e) — CI-Plan auf dem PR-Commit; manuell: --dispatch-long`);
  for (const entry of report.open) console.log(`Offen         ${entry}`);
  console.log(`Bericht       ${relative(ROOT, join(dir, 'agent-summary.json')).replaceAll('\\', '/')}`);
}
process.exit(failed.length === 0 ? 0 : 1);
