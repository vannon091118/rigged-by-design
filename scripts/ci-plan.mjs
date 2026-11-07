#!/usr/bin/env node
/**
 * CI-Plan fuer GitHub Actions: liest Basis und Kopf aus dem Event, waehlt
 * Gates und Tests und schreibt Matrix, Testauswahl und Bericht.
 *
 * Aufruf:
 *   node scripts/ci-plan.mjs --base=<sha> --head=<sha> [--profile=full]
 *        [--impact=1] [--github-output=<datei>]
 *
 * Verhalten:
 * - `--impact=1` verengt den Plan nach echtem Diff (nur PR-Pfad).
 * - Ohne Impact oder bei nicht bestimmbarem Diff laeuft das volle Profil.
 * - Eine leere Matrix ist ein Fehler, kein Freischein.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ADVISORY_GATES, planForCI, planReport } from './lib/ci-plan.mjs';
import { planGates } from './lib/pipeline-plan.mjs';
import { ROOT } from './lib/report.mjs';

const arg = (name) => {
  const args = process.argv.slice(2);
  const hit = args.find((value) => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  // Auch die Schreibweise `--flag wert` akzeptieren: ein Leerzeichen statt `=`
  // hat die Matrix schon einmal leer gelassen und den Plan-Job gekippt.
  const index = args.indexOf(`--${name}`);
  const next = index >= 0 ? args[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
};

const base = arg('base') ?? '';
const head = arg('head') ?? '';
const profile = arg('profile') ?? 'full';
const impact = ['1', 'true'].includes(String(arg('impact') ?? '').toLowerCase());
const fullTests = ['1', 'true'].includes(String(arg('full-tests') ?? '').toLowerCase());
const outputFile = arg('github-output');
const reportPath = resolve(ROOT, process.env.CI_PLAN_PATH ?? '.verify-cache/ci-plan.json');

const result = planForCI({ base, head, profile, impact, fullTests });
// Ohne Diff bleibt es beim Profil des Laufs, nie bei einem einzelnen Gate.
const fallback = planGates(profile) ?? planGates('full');
const plan = result?.plan ?? {
  changed: [],
  gates: fallback.map((gate) => ({ gate })),
  gateKeys: fallback,
  reason: 'Diff nicht bestimmbar oder ohne Basis: konservativ volles Profil',
  skipped: [],
  tests: { files: [], runAll: true, reason: `vollstaendiges Profil ${profile}`, shards: [], long: [] },
  advisory: [...ADVISORY_GATES],
  required: fallback,
};

const matrix = JSON.stringify({ include: plan.gates });
const testFiles = plan.tests.runAll ? '' : plan.tests.files.join(',');
const longFiles = plan.tests.long ?? [];
// Ein leerer `include`-Block ist fuer GitHub keine gueltige Matrix. Der
// Sentinel haelt den Ausdruck parsebar; der Job selbst bleibt per `if` aus.
const longMatrix = JSON.stringify({ include: (longFiles.length > 0 ? longFiles : ['']).map((file) => ({ file })) });
const report = planReport(result?.changed ?? [], plan);

if (plan.gates.length === 0) {
  console.error('ci-plan: leere Matrix; das waere ein Freischein statt einer Pruefung');
  process.exit(1);
}

const lines = [
  `### CI-Plan (${plan.reason})`,
  '',
  `Basis: \`${base || '-'}\` · Kopf: \`${head || '-'}\` · Profil: \`${profile}\` · Impact: \`${impact ? 'an' : 'aus'}\``,
  '',
  `| Feld | Wert |`,
  `| --- | --- |`,
  `| Geaenderte Dateien | ${result?.changed.length ?? 0} |`,
  `| Gates (required) | ${plan.gateKeys.join(', ')} |`,
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
