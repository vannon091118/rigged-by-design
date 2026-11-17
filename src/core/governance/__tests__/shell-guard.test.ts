/**
 * @test-target: scripts/lib/shell-guard.mjs
 * @error-code: ERR-4019
 *
 * Die guarded Shell ist die lokale zweite Ebene: Pflichtlektuere vor Arbeit,
 * keine destructiven Git-Befehle, kein main-Push, kein Agenten-Merge und
 * keine Gate-Pipe. Verstoesse werden gezaehlt, damit der Watcher eskaliert.
 */
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { READING_PATHS } from '../../../../scripts/lib/doc-core.mjs';
import { writeReceipt } from '../../../../scripts/lib/doc-read.mjs';
import {
  guardState,
  guardStatusLine,
  recordViolation,
  shellGuardDecision,
} from '../../../../scripts/lib/shell-guard.mjs';

const ROOT = process.cwd();

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rbd-shell-guard-'));
  for (const path of READING_PATHS) cpSync(join(ROOT, path), join(root, path));
  return root;
}

describe('Shell-Gate', () => {
  it('erzwingt den Lesepfad vor grep und erlaubt den Lesebefehl', () => {
    const root = fixture();
    const grep = shellGuardDecision({ command: 'grep foo src', root });
    expect(grep.decision).toBe('deny');
    expect(grep.code).toBe('DOC_READ');
    expect(shellGuardDecision({ command: 'pnpm rbd docs read', root }).decision).toBe('allow');
  });

  it('blockiert destructives Git auch mit gueltigem Receipt', () => {
    const root = fixture();
    writeReceipt(root);
    expect(shellGuardDecision({ command: 'git reset --hard HEAD', root }).code).toBe('FORBIDDEN');
    expect(shellGuardDecision({ command: 'git push origin main', root }).code).toBe('FORBIDDEN');
    expect(shellGuardDecision({ command: 'gh pr merge 12', root }).code).toBe('FORBIDDEN');
    expect(shellGuardDecision({ command: 'git push origin lane/x', root }).decision).toBe('allow');
  });

  it('blockiert verlustreiche Gate-Pipes und zaehlt den Verstoss', () => {
    const root = fixture();
    writeReceipt(root);
    const pipe = shellGuardDecision({ command: 'pnpm verify light | head', root });
    expect(pipe.code).toBe('LOSSY_PIPE');
    recordViolation({ root, command: 'pnpm verify light | head', reason: pipe.reason, code: pipe.code });
    const state = guardState(root);
    expect(state.count).toBe(1);
    expect(guardStatusLine(root)).toContain('Verstoesse 1');
  });
});
