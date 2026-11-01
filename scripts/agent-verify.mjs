#!/usr/bin/env node
/**
 * Ein Ablauf statt drei: Impact bestimmen, Gates daraus planen, Cache nutzen,
 * einen Bericht schreiben. Nutzt `impact`, `pipeline-plan` und `gate-runner` —
 * es gibt keine zweite Pipeline und keinen zweiten Gate-Plan.
 *
 * `--profile=quick` laeuft die schnellen Gates und, wenn der Impact es erlaubt,
 * nur die betroffenen Tests. Diese Auswahl ist ausdruecklich Teilpruefung; der
 * Bericht nennt sie so. `--ci` delegiert die langen Nachweise an Actions und
 * wartet auf das Ergebnis.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { impact } from './lib/impact.mjs';
import { GATES, planGates } from './lib/pipeline-plan.mjs';
import { runGates } from './lib/gate-runner.mjs';
import { ROOT } from './lib/report.mjs';

const argv = process.argv.slice(2);
const profileArg = argv.find((value) => value.startsWith('--profile='));
const PROFILE = profileArg ? profileArg.slice('--profile='.length) : 'quick';
const CI = argv.includes('--ci');
const AS_JSON = argv.includes('--json');

const state = impact({ profile: PROFILE });
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

if (CI && report.delegated.length > 0) {
  console.log(`agent:verify: ${report.delegated.length} lange Nachweis(e) an Actions delegiert`);
  const run = spawnSync(process.execPath, ['scripts/ci-long-checks.mjs'], { cwd: ROOT, stdio: 'inherit' });
  report.ciLong = run.status === 0 ? 'success' : 'failed';
  writeFileSync(join(dir, 'agent-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const counts = report.gates.reduce((acc, gate) => {
    acc[gate.result] = (acc[gate.result] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `agent:verify ${PROFILE}: ${failed.length === 0 ? 'PASS' : 'ROT'} · ` +
      `${Object.entries(counts).map(([key, value]) => `${value} ${key}`).join(', ')} · ${Math.round(durationMs / 1000)}s`,
  );
  if (subset.length > 0) console.log(`  Teilpruefung: ${subset.length} betroffene Testdatei(en), kein Vollnachweis`);
  if (report.delegated.length > 0) console.log(`  Delegiert: ${report.delegated.length} lange Nachweis(e) — npm run agent:verify -- --ci`);
  console.log(`  Bericht: ${relative(ROOT, join(dir, 'agent-summary.json')).replaceAll('\\', '/')}`);
}
process.exit(failed.length === 0 ? 0 : 1);
