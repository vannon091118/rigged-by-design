#!/usr/bin/env node
/**
 * Squash-Nachricht aus dem PR-Body: Titelzeile plus die drei Pflichtsektionen.
 *
 * Gibt genau den Text aus, der beim Merge in `commit_message` gehoert. Der
 * Body kommt aus einer Datei, aus `gh pr view` oder aus `PR_BODY`; Titel aus
 * `--title` oder aus der ersten Body-Zeile. Fehlt eine Sektion, endet der Lauf
 * mit Exit 1 und ohne Nachricht: derselbe Pruefer wie `verify-commit-msg`.
 *
 *   node scripts/merge-commit-message.mjs --title "..." --body-file body.md
 *   node scripts/merge-commit-message.mjs --pr 123 --json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { squashMessage } from './lib/commit-msg.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'merge-commit-message' });

const args = process.argv.slice(2);
const value = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? (args[at + 1] ?? '') : null;
};
const asJson = args.includes('--json');

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
process.stdout.write(`${result.message}\n`);
