/**
 * @test-target: scripts/lib/commit-msg.mjs
 * @error-code: ERR-4006
 *
 * Die Pflichtsektionen sind nur dann echt, wenn der Weg vom PR-Body zur
 * Squash-Nachricht sie traegt. Der Test prueft den Bauer direkt, den
 * CLI-Weg gegen das echte Gate und zwei Fehlerfaelle: fehlende Sektion und
 * ASCII-Variante. Eine Nachricht ohne Sektionen darf nicht entstehen.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS, messageViolations, squashMessage } from '../../../../scripts/lib/commit-msg.mjs';

const ROOT = resolve(process.cwd());
const CLI = join(ROOT, 'scripts', 'merge-commit-message.mjs');
const GATE = join(ROOT, 'scripts', 'verify-commit-msg.mjs');
const BODY = [
  '## Changes (Was ist neu)',
  '- Etwas Konkretes mit Inhalt.',
  '',
  '## Technische Basis & Kausalität',
  '- Ein Beleg mit Messung.',
  '',
  '## Ausblick (Nächste Schritte)',
  '- Ein naechster Schritt mit Ziel.',
].join('\n').replace(/^## /gm, '### ');

const node = (args: string[], input?: string) =>
  spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024 });

describe('Squash-Nachricht aus dem PR-Body', () => {
  it('baut eine Nachricht, die dieselbe Regel besteht wie das Gate', () => {
    const result = squashMessage({ title: 'Squash-Nachricht belegen', body: BODY });
    expect(result.ok).toBe(true);
    expect(result.message.split('\n')[0]).toBe('Squash-Nachricht belegen');
    expect(messageViolations(result.message)).toEqual([]);
    for (const section of SECTIONS) expect(result.message).toContain(section);
  });

  it('liefert ohne Pflichtsektion keine Nachricht', () => {
    const result = squashMessage({ title: 'Nur ein Titel', body: '### Changes (Was ist neu)\n- Nur ein Punkt.' });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('');
    expect(result.violations.map((hit: { message: string }) => hit.message)).toContain(
      'Pflichtsektion fehlt: ### Technische Basis & Kausalität',
    );
  });

  it('lehnt eine Pflichtsektion als Titel ab', () => {
    const result = squashMessage({ title: SECTIONS[0], body: BODY });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('');
    expect(result.violations.map((hit: { message: string }) => hit.message)).toContain(
      'Titel ist eine Markdown-Ueberschrift statt einer Aussage',
    );
    const headered = `### Changes (Was ist neu)\n\n${BODY}`;
    expect(messageViolations(headered).map((hit: { message: string }) => hit.message)).toContain(
      'Titel ist eine Markdown-Ueberschrift statt einer Aussage',
    );
  });

  it('bleibt bei ASCII-Ueberschriften rot', () => {
    const ascii = BODY.replace('### Technische Basis & Kausalität', '### Technische Basis & Kausalitaet')
      .replace('### Ausblick (Nächste Schritte)', '### Ausblick (Naechste Schritte)');
    expect(squashMessage({ title: 'ASCII-Variante', body: ascii }).ok).toBe(false);
  });

  it('erzeugt ueber die CLI einen Text, den verify-commit-msg akzeptiert', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-msg-'));
    const bodyFile = join(dir, 'body.md');
    const msgFile = join(dir, 'message.txt');
    writeFileSync(bodyFile, `${BODY}\n`);
    const built = node([CLI, '--title', 'Squash-Nachricht belegen', '--body-file', bodyFile, '--out', msgFile]);
    expect(built.status, built.stderr).toBe(0);
    expect(readFileSync(msgFile, 'utf8')).toContain('### Ausblick (Nächste Schritte)');
    expect(readFileSync(msgFile, 'utf8').split('\n')[0]).toBe('Squash-Nachricht belegen');
    const gate = node([GATE, msgFile]);
    expect(gate.status, `${gate.stdout}${gate.stderr}`).toBe(0);
  });

  it('verweigert ueber die CLI einen Body ohne Sektionen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-msg-'));
    const bodyFile = join(dir, 'body.md');
    writeFileSync(bodyFile, '### Changes (Was ist neu)\n- Nur ein Punkt ohne Technik und Ausblick.\n');
    const built = node([CLI, '--title', 'Unvollstaendig', '--body-file', bodyFile, '--out', join(dir, 'message.txt')]);
    expect(built.status).toBe(1);
    expect(`${built.stdout}${built.stderr}`).toContain('ERR-4006');
    expect(() => readFileSync(join(dir, 'message.txt'), 'utf8')).toThrow();
  });
});
