#!/usr/bin/env node
/** Steam-Developer-Notes-Gate: deutsche Pflichtsektionen, keine Fremd-Trailer. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fail } from './lib/report.mjs';
import { captureConsole } from './lib/compact.mjs';
import { messageViolations } from './lib/commit-msg.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-commit-msg' });

const args = process.argv.slice(2);
// `--range <a>..<b>` prueft jeden Nicht-Merge-Commit im Bereich. Der pre-push
// Hook nutzt denselben Pruefer statt einer zweiten Nachrichten-Logik.
const rangeAt = args.indexOf('--range');
const range = rangeAt >= 0 ? (args[rangeAt + 1] ?? '') : null;

function readInput() {
  if (args.includes('--head')) return execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' });
  if (args.includes('--pr')) return process.env.PR_BODY ?? '';
  const file = args.find((arg, position) => !arg.startsWith('--') && !(rangeAt >= 0 && position === rangeAt + 1));
  return file ? readFileSync(file, 'utf8') : '';
}

/** Alle Regeln an genau einer Stelle: Commit, Datei, PR-Body und Bereich teilen sie. */
const violations = messageViolations;

if (range !== null) {
  let shas = [];
  try {
    shas = execFileSync('git', ['rev-list', '--no-merges', range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    fail(1, 'ERR-4006', 'verify-commit-msg', `Bereich nicht lesbar: ${range}`);
    process.exit(1);
  }
  let index = 0;
  let bad = 0;
  for (const sha of shas) {
    const text = execFileSync('git', ['log', '-1', '--pretty=%B', sha], { encoding: 'utf8' });
    for (const hit of violations(text)) {
      index += 1;
      fail(index, hit.code, 'verify-commit-msg', `${sha.slice(0, 7)}: ${hit.message}`);
      bad += 1;
    }
  }
  if (bad > 0) process.exit(1);
  console.log(`verify-commit-msg: Bereich PASS (${shas.length} Commit(s), Merges uebersprungen)`);
  process.exit(0);
}

const text = readInput();
// Ein leerer PR-Body bestand das Gate bisher ohne einen einzigen Fehlschlag.
if (args.includes('--pr') && !text.trim()) {
  fail(1, 'ERR-4006', 'verify-commit-msg', 'PR-Body fehlt; Pflichtsektionen nicht pruefbar');
  process.exit(1);
}

let index = 0;
let failures = 0;
for (const hit of violations(text, { pr: args.includes('--pr') })) {
  index += 1;
  fail(index, hit.code, 'verify-commit-msg', hit.message);
  failures += 1;
}

if (failures > 0) process.exit(1);
console.log(args.includes('--pr') ? 'verify-commit-msg: PR-Body PASS' : 'verify-commit-msg: PASS');
