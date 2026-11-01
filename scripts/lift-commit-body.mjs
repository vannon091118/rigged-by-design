#!/usr/bin/env node
/**
 * Hebt einen Commit-Body in den PR-Body: Eskalation statt Fail-Closed.
 *
 * Fehlt die Developer-Notes-Struktur, wird sie aus Subject und Body gebaut.
 * Ohne `gh` oder ohne Anmeldung bleibt der Lauf gruen: der Body liegt dann in
 * `.git/rbd-pr-body.md`, und der Agent kann ihn beim naechsten PR setzen.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/report.mjs';

const SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);
const dryRun = process.argv.includes('--dry-run');
const git = (argv) => execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8' }).trim();

function buildBody() {
  const subject = git(['log', '-1', '--pretty=%s']);
  const raw = git(['log', '-1', '--pretty=%b']);
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines
    .filter((line) => !line.startsWith('### '))
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
const body = buildBody();
// In einem Worktree ist `.git` eine Datei: das Verzeichnis kommt aus git selbst.
const file = resolve(ROOT, git(['rev-parse', '--git-dir']), 'rbd-pr-body.md');
writeFileSync(file, `${body}\n`);
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
    gh(['pr', 'create', '--base', 'main', '--head', branch, '--title', git(['log', '-1', '--pretty=%s']), '--body-file', file]);
    console.log('pr-escalation: PR angelegt');
  }
} catch (error) {
  const reason = error instanceof Error ? error.message.split('\n')[0] : 'Fehler';
  console.log(`pr-escalation: gh nicht verfuegbar (${reason}); Body liegt in .git/rbd-pr-body.md`);
}
process.exit(0);
