#!/usr/bin/env node
/**
 * Squash-Nachricht aus dem PR-Body: Titelzeile plus die drei Pflichtsektionen.
 *
 * Der Body kommt aus `--body-file`, aus `--pr <n>` (gh) oder aus `PR_BODY`;
 * der Titel aus `--title` oder aus der ersten Body-Zeile. Fehlt eine Sektion,
 * endet der Lauf mit Exit 1 und ohne Nachricht: derselbe Pruefer wie
 * `verify-commit-msg`.
 *
 * Ausgabe: `--out <datei>` schreibt den vollstaendigen Text und meldet knapp.
 * Ohne `--out` steht der Text auf stdout, wenn `--json` oder RBD_OUTPUT_FULL=1
 * gesetzt ist; sonst bleibt es beim Hinweis, damit kein gekuerzter Body
 * versehentlich als Commit-Nachricht landet.
 *
 *   node scripts/merge-commit-message.mjs --title "..." --body-file body.md --out msg.txt
 *   node scripts/merge-commit-message.mjs --pr 123 --json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { squashMessage } from './lib/commit-msg.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; der Volltext geht ueber --out.
captureConsole({ label: 'merge-commit-message' });

const args = process.argv.slice(2);
const value = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? (args[at + 1] ?? '') : null;
};
const asJson = args.includes('--json');
const full = asJson || process.env.RBD_OUTPUT_FULL === '1';

function fail(reason) {
  console.error(`merge-commit-message: ${reason}; keine Nachricht`);
  process.exit(1);
}

function readBody() {
  const file = value('--body-file');
  if (file) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      fail(`body-file nicht lesbar (${file})`);
    }
  }
  const pr = value('--pr');
  if (pr) {
    try {
      return execFileSync('gh', ['pr', 'view', pr, '--json', 'body', '--jq', '.body'], { encoding: 'utf8' });
    } catch {
      fail(`PR #${pr} nicht lesbar (gh fehlt oder kein Token)`);
    }
  }
  return process.env.PR_BODY ?? '';
}

const body = readBody();
const title = value('--title') ?? String(body).split(/\r?\n/).find((line) => line.trim()) ?? '';
const result = squashMessage({ title, body });

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
if (!result.ok) {
  for (const hit of result.violations) console.error(`${hit.code}: ${hit.message}`);
  fail('PR-Body traegt die Pflichtsektionen nicht');
}

const lines = result.message.split('\n').length;
const target = value('--out');
if (target) {
  try {
    writeFileSync(target, `${result.message}\n`, 'utf8');
  } catch {
    fail(`Ziel nicht schreibbar (${target})`);
  }
  console.log(`merge-commit-message: Nachricht geschrieben (${lines} Zeilen, ${target})`);
  process.exit(0);
}
if (full) {
  process.stdout.write(`${result.message}\n`);
  process.exit(0);
}
console.log(`merge-commit-message: Nachricht bereit (${lines} Zeilen); --out <datei> schreibt sie vollstaendig`);
