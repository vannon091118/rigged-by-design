#!/usr/bin/env node
/**
 * Hebt einen Commit-Body in den PR-Body: Eskalation statt Fail-Closed.
 *
 * Zwei Wege, ein Body: `gh` (CI, Token vorhanden) oder der GitHub-Connector
 * (Agenten ohne CLI-Token). `--json` liefert den Plan maschinenlesbar; der Lauf
 * bleibt gruen, weil die Eskalation die Entscheidung verschiebt, nicht blockiert.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describePlan, plan } from './lib/escalation.mjs';
import { ROOT } from './lib/report.mjs';

const SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const asJson = args.includes('--json') || args.includes('--connector');
const git = (argv) => execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' }).trim();

function buildBody() {
  const subject = git(['log', '-1', '--pretty=%s']);
  const raw = git(['log', '-1', '--pretty=%b']);
  const bullets = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('### '))
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .slice(0, 12);
  return [
    SECTIONS[0],
    ...[subject, ...bullets].map((line) => `- ${line}`),
    '',
    SECTIONS[1],
    '- Automatisch aus dem Commit-Body gehoben; Inhalt unveraendert, nur die Pflichtstruktur ergaenzt.',
    '- Die Eskalation ersetzt kein Gate: die Entscheidung wandert vom Hook in den PR.',
    '',
    SECTIONS[2],
    '- CI prueft den Stand; offene Punkte gehoeren in genau diesen Abschnitt.',
  ].join('\n');
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const title = git(['log', '-1', '--pretty=%s']);
const body = buildBody();
// In einem Worktree ist `.git` eine Datei: das Verzeichnis kommt aus git selbst.
const file = resolve(ROOT, git(['rev-parse', '--git-dir']), 'rbd-pr-body.md');
writeFileSync(file, `${body}\n`);
const escalation = plan('commit body pflichtsektion struktur fehlt');
const connector = { level: escalation.level, channel: 'github-connector', branch, base: 'main', title, bodyFile: file, body };

if (asJson) {
  console.log(JSON.stringify(connector, null, 2));
  process.exit(0);
}

console.log(`pr-escalation: Body aus ${branch} gebaut (${body.split('\n').length} Zeilen)`);
if (dryRun) {
  console.log(body);
  process.exit(0);
}

const gh = (argv) => execFileSync('gh', argv, { cwd: ROOT, encoding: 'utf8' }).trim();
try {
  const existing = gh(['pr', 'list', '--head', branch, '--json', 'number', '--jq', '.[0].number']);
  if (existing) {
    gh(['pr', 'edit', existing, '--body-file', file]);
    console.log(`pr-escalation: PR #${existing} aktualisiert`);
  } else {
    gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body-file', file]);
    console.log('pr-escalation: PR angelegt');
  }
} catch (error) {
  const reason = error instanceof Error ? error.message.split('\n')[0] : 'Fehler';
  console.log(`pr-escalation: gh nicht verfuegbar (${reason})`);
  console.log(describePlan(escalation));
  console.log('  Connector-Plan: node scripts/lift-commit-body.mjs --json');
  console.log(`  Body: ${file}`);
}
process.exit(0);
