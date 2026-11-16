#!/usr/bin/env node
/**
 * Gate: Jeder Pflicht-Einstiegspunkt haelt das 500-Token-Budget.
 *
 * Zwei Beweise, ein Gate:
 *   1. statisch — jede Datei aus `scripts/lib/entry-points.mjs` ruft
 *      `captureConsole` auf und importiert den Vertrag aus `compact.mjs`.
 *      Damit kann kein neuer Einstiegspunkt ohne Kapselung dazukommen.
 *   2. dynamisch (`--probe`) — die offline pruefbaren Einstiegspunkte laufen
 *      wirklich, und ihre Ausgabe wird mit derselben konservativen Schaetzung
 *      gemessen wie im Betrieb. Ueberschreitung oder fehlender Logverweis ist
 *      ein roter Befund.
 *
 * Das Gate selbst schreibt durch `captureConsole`, also gilt sein Budget auch
 * fuer ihn. Exit 0 = alle Pfade im Budget, Exit 1 = mindestens ein Verstoss.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { captureConsole, compact, estimateTokens, TOKEN_BUDGET } from './lib/compact.mjs';
import { ENTRY_POINTS } from './lib/entry-points.mjs';
import { fail, ROOT } from './lib/report.mjs';

captureConsole({ label: 'verify-output-budget' });
const withProbe = process.argv.includes('--probe');
const findings = [];

for (const entry of ENTRY_POINTS) {
  let text;
  try {
    text = readFileSync(join(ROOT, entry.file), 'utf8');
  } catch {
    findings.push(`${entry.id}: ${entry.file} fehlt`);
    continue;
  }
  if (!text.includes('captureConsole')) findings.push(`${entry.id}: ${entry.file} ruft captureConsole nicht auf`);
  if (!text.includes("from './lib/compact.mjs'")) findings.push(`${entry.id}: ${entry.file} importiert den Budget-Vertrag nicht`);
}

// Kein Altpfad: jedes Top-Level-Skript mit Ausgabe laeuft durch den Vertrag.
// Einzige Ausnahme ist reines Werkzeugformat (JSON als ganze Antwort).
const JSON_ONLY = new Set(['scripts/install-webhook.mjs']);
for (const name of readdirSync(join(ROOT, 'scripts')).filter((entry) => entry.endsWith('.mjs'))) {
  const file = `scripts/${name}`;
  const source = readFileSync(join(ROOT, file), 'utf8');
  if (!/console\.(log|error)\(|process\.stdout\.write/.test(source)) continue;
  if (!source.includes('captureConsole') && !JSON_ONLY.has(file)) findings.push(`${file}: Ausgabe ohne captureConsole (Altpfad)`);
}

let measured = 0;
if (withProbe) {
  for (const entry of ENTRY_POINTS.filter((item) => item.dynamic)) {
    const result = spawnSync(process.execPath, [join(ROOT, entry.file), ...(entry.probe ?? [])], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, RBD_OUTPUT_BUDGET_PROBE: '1' },
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    measured += 1;
    const tokens = estimateTokens(output);
    if (tokens > TOKEN_BUDGET) findings.push(`${entry.id}: ${tokens} Token (Budget ${TOKEN_BUDGET})`);
    const shortened = output.includes('gekuerzt') || output.includes('\u2026');
    if (shortened && !/vollstaendig (im Log|mit --log)|vollstaendig: /.test(output)) findings.push(`${entry.id}: gekuerzte Ausgabe nennt ihr Log nicht`);
  }
}

if (findings.length > 0) {
  console.error(
    compact({
      status: 'ROT',
      headline: `${findings.length} Verstoss/Verstoesse gegen das Ausgabe-Budget`,
      facts: [
        ['Budget', `${TOKEN_BUDGET} Token (konservativ, Bytes / 3)`],
        ['Einstiege', `${ENTRY_POINTS.length} registriert, ${measured} dynamisch gemessen`],
      ],
      findings,
    }),
  );
  fail(1, 'ERR-4019', 'output-budget', `${findings.length} Pflicht-Einstiegspunkt(e) ausserhalb des Vertrags`);
  process.exit(1);
}

console.log(
  compact({
    status: 'GRUEN',
    headline: 'alle Pflicht-Einstiegspunkte im Ausgabe-Budget',
    facts: [
      ['Budget', `${TOKEN_BUDGET} Token (konservativ, Bytes / 3)`],
      ['Einstiege', `${ENTRY_POINTS.length} registriert, ${measured} dynamisch gemessen`],
      ['Ausnahme', 'nur --json (Werkzeugformat) und RBD_OUTPUT_FULL=1'],
    ],
  }),
);
process.exit(0);
