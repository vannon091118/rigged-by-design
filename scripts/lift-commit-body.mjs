#!/usr/bin/env node
/**
 * Hebt den vollstaendigen PR-Diff in einen abgegrenzten Automationsbereich.
 *
 * Vorhandene PR-Bodys bleiben unveraendert: geschrieben wird ausschliesslich
 * zwischen `AUTO_START` und `AUTO_END`. Fehlt der Bereich, wird er angehaengt.
 * Ist die Markerlage unklar, faellt keine Schreiboperation.
 *
 * Der Text stammt aus `git diff --name-status basis...head` - also aus allen
 * Commits des PR, nicht aus dem letzten. Der Workflow checkt dafuer `main` aus
 * und holt den Push-Branch nur als Ref; fremder Code laeuft hier nie.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  describeAutomation,
  mergeAutomation,
  missingSections,
  parseNameStatus,
  splitAutomation,
} from './lib/body-sync.mjs';
import { describePlan, plan } from './lib/escalation.mjs';
import { ROOT } from './lib/report.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const asJson = args.includes('--json') || args.includes('--connector');

const run = (command, argv) => {
  try {
    return execFileSync(command, argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
};
const git = (argv) => run('git', argv);
const gh = (argv) => run('gh', argv);

const branch = process.env.HEAD_BRANCH || git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
const requested = process.env.HEAD_SHA ?? '';
const head = (requested && git(['rev-parse', '--verify', requested])) || git(['rev-parse', 'HEAD']) || 'HEAD';
const baseRef = process.env.BASE_REF || 'origin/main';
const base = git(['merge-base', baseRef, head]);
const title = git(['log', '-1', '--pretty=%s', head]) ?? `PR ${branch}`;
const commitText = base ? git(['log', '--pretty=format:%s%n%b', `${base}..${head}`]) ?? '' : '';
const entries = base ? parseNameStatus(git(['diff', '--name-status', `${base}...${head}`]) ?? '') : [];

// Der PR existiert schon? Dann ist sein Body die einzige Wahrheit, die zaehlt.
// Laeuft `gh` nicht, wird nichts geschrieben: ein Body, den niemand gelesen hat,
// darf auch niemand ersetzen.
const listed = gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number', '--jq', '.[0].number']);
const ghUsable = listed !== null;
const number = ghUsable && /^\d+$/.test(listed) ? listed : '';
let existing = '';
let readable = true;
if (number) {
  const body = gh(['pr', 'view', number, '--json', 'body', '--jq', '.body']);
  readable = body !== null;
  existing = body ?? '';
}

const outside = splitAutomation(existing).outside;
const payload = describeAutomation({ entries, outside, commitText, base: base ?? '', head });
const merged = mergeAutomation(existing, payload);
const gitDir = git(['rev-parse', '--git-dir']) ?? '.git';
const file = resolve(ROOT, gitDir, 'rbd-pr-body.md');
if (merged.ok) writeFileSync(file, `${merged.body}\n`);

const escalation = plan('commit body pflichtsektion struktur fehlt');
const connector = {
  level: escalation.level,
  channel: 'github-connector',
  branch,
  base: 'main',
  title,
  bodyFile: file,
  diffBase: base,
  diffFiles: entries.length,
  write: merged.ok && readable,
  changed: merged.ok ? merged.changed : false,
  reason: merged.ok ? (readable ? null : 'PR-Body nicht lesbar') : merged.reason,
  body: merged.ok ? merged.body : existing,
};

if (asJson) {
  console.log(JSON.stringify(connector, null, 2));
  process.exit(merged.ok && readable ? 0 : 1);
}

if (!merged.ok) {
  console.error(`pr-escalation: ${merged.reason}; Body bleibt unveraendert (keine Schreiboperation)`);
  process.exit(1);
}
if (!readable) {
  console.error(`pr-escalation: PR #${number} ist vorhanden, aber sein Body nicht lesbar; keine Schreiboperation`);
  process.exit(1);
}

console.log(
  `pr-escalation: Bereich aus ${base ? `${base.slice(0, 7)}...${head.slice(0, 7)}` : 'unbekannter Basis'} (${entries.length} Dateien)`,
);
if (dryRun) {
  console.log(merged.body);
  process.exit(0);
}

if (!ghUsable) {
  console.log('pr-escalation: gh nicht verfuegbar; keine Schreiboperation');
  console.log(describePlan(escalation));
  console.log('  Connector-Plan: node scripts/lift-commit-body.mjs --json');
  console.log(`  Body: ${file}`);
  process.exit(0);
}

if (number) {
  if (!merged.changed) {
    console.log(`pr-escalation: PR #${number} ist bereits aktuell (keine Aenderung)`);
    process.exit(0);
  }
  if (gh(['pr', 'edit', number, '--body-file', file]) === null) {
    console.error(`pr-escalation: PR #${number} nicht aktualisiert`);
    process.exit(1);
  }
  console.log(`pr-escalation: PR #${number} aktualisiert (nur Automationsbereich)`);
  process.exit(0);
}

// Ohne PR: nur anlegen, wenn die Commit-Nachricht die Pflichtstruktur nicht
// traegt. Ist sie vollstaendig, legt `promote` den PR an - kein zweiter Weg.
const commitBody = git(['log', '-1', '--pretty=%B', head]) ?? '';
if (missingSections(commitBody).length === 0) {
  console.log('pr-escalation: Commit-Body vollstaendig; PR legt promote an');
  process.exit(0);
}
if (gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body-file', file]) === null) {
  console.error('pr-escalation: PR nicht angelegt');
  process.exit(1);
}
console.log('pr-escalation: PR angelegt');
process.exit(0);
