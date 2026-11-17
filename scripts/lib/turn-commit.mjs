/**
 * Commit-Nachricht eines Turns: inhaltliche Notes oder eine ehrliche
 * Doku-/Governance-Vorlage. Das Notes-Gate laeuft vor dem Commit.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  classifyPaths, describeDiff, evaluateNotes, hasCodeChanges, parseNameStatus, REQUIRED_SECTIONS,
} from './body-sync.mjs';
import { ROOT } from './report.mjs';

export function prepareCommitMessage({ git, files, fail }) {
  const entries = parseNameStatus(git(['diff', '--cached', '--name-status']));
  const groups = classifyPaths(entries);
  const notesPath = resolve(ROOT, '.turn-notes.md');
  const notes = existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : '';
  const notesCheck = evaluateNotes(notes);
  const removedExports = git(['diff', '--cached', '-U0'])
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('---') && /^-\s*export\b/.test(line));
  if (removedExports.length > 0 && !/(?:kette|chain|import|re-export|aufrufer|verbraucher)/i.test(notes)) {
    fail(
      1,
      'ERR-4003',
      'turn:finish',
      `Export-Entfernung ohne Chain-Trace in .turn-notes.md (${removedExports.length} Zeile(n)); Import-/Re-Export-/Aufrufer-Kette dokumentieren und reparieren, nicht blind cutten`,
    );
    process.exit(1);
  }
  if (!notesCheck.ok && hasCodeChanges(groups)) {
    const code = [...groups.runtime, ...groups.tests, ...groups.content, ...groups.tooling]
      .slice(0, 8)
      .map((entry) => entry.path)
      .join(', ');
    fail(1, 'ERR-4006', 'turn:finish', `Codeaenderung ohne inhaltliche .turn-notes.md (${code}); kein irrefuehrender Commit`);
    process.exit(1);
  }
  let message;
  if (notesCheck.ok) {
    message = notes.trim();
  } else {
    message = [
      `Doku/Governance: ${files.length} Datei(en) aktualisiert`,
      '',
      REQUIRED_SECTIONS[0],
      ...describeDiff(entries, { groups }).map((line) => `- ${line}`),
      '',
      REQUIRED_SECTIONS[1],
      '- Keine Runtime-, Test- oder Inhaltsaenderung im Diff; geaendert sind nur Dokumentation, Governance oder die Versionszeile.',
      '',
      REQUIRED_SECTIONS[2],
      '- Offene Punkte stehen in docs/ROADMAP-DETAIL.md; dieser Commit behauptet keine Spielaenderung.',
    ].join('\n');
  }

  const gitDir = git(['rev-parse', '--git-dir']);
  const messageFile = resolve(ROOT, gitDir, 'TURN_COMMIT_MSG');
  writeFileSync(messageFile, `${message}\n`);
  spawnSync(process.execPath, ['scripts/sanitize-commit.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
  const gate = spawnSync(process.execPath, ['scripts/verify-commit-msg.mjs', messageFile], { cwd: ROOT, stdio: 'inherit' });
  if (gate.status !== 0) {
    fail(1, 'ERR-4006', 'turn:finish', 'Commit-Nachricht besteht das Notes-Gate nicht');
    process.exit(1);
  }

  const title = (readFileSync(messageFile, 'utf8').split('\n', 1)[0] ?? '').trim();
  if (title && title === git(['log', '-1', '--pretty=%s'])) {
    fail(1, 'ERR-4006', 'turn:finish', `Titel "${title}" ist identisch mit HEAD; neue .turn-notes.md schreiben`);
    process.exit(1);
  }
  return { messageFile, notesPath };
}
