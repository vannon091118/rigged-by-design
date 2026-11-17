/**
 * @test-target: scripts/lib/doc-read.mjs
 * @error-code: ERR-4017
 *
 * Der 10k-Lesepfad ist ein Receipt, keine Behauptung: sieben Kerne, ein Hash
 * je Dokument. Der PreToolUse-Hook darf vor dem Lesen nur den Lesebefehl und
 * das direkte Read eines Kerns zulassen; nach dem Lesen blockiert er nur noch
 * verlustreiche Gate-Pipes.
 */
import { appendFileSync, cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { READING_PATHS } from '../../../../scripts/lib/doc-core.mjs';
import { readingBudget, receiptProblems, writeReceipt } from '../../../../scripts/lib/doc-read.mjs';
import { pretoolDecision } from '../../../../scripts/lib/agent-pretool.mjs';

const ROOT = process.cwd();

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rbd-doc-read-'));
  for (const path of READING_PATHS) {
    cpSync(join(ROOT, path), join(root, path));
  }
  return root;
}

describe('10k-Lesepfad', () => {
  it('liest sieben Kerne und bleibt unter dem Budget', () => {
    const report = readingBudget(ROOT);
    expect(report.entries).toHaveLength(7);
    expect(report.ok).toBe(true);
    expect(report.tokens).toBeLessThanOrEqual(report.budget);
  });

  it('schreibt ein Receipt und erkennt eine Aenderung', () => {
    const root = fixture();
    expect(receiptProblems(root).join('\n')).toContain('Pflichtlektuere fehlt');
    expect(writeReceipt(root).ok).toBe(true);
    expect(receiptProblems(root)).toEqual([]);
    // Nur der Kern ist der Lesevertrag: Prosa ausserhalb darf das Receipt
    // nicht staendig invalidieren.
    appendFileSync(join(root, 'docs/TESTING.md'), '\nNachtrag ausserhalb des Kerns\n');
    expect(receiptProblems(root)).toEqual([]);
    const path = join(root, 'docs/TESTING.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('**Grenze:**', '**Grenze:** geaendert'), 'utf8');
    expect(receiptProblems(root).join('\n')).toContain('seit dem Lesen geaendert');
  });
});

describe('PreToolUse', () => {
  it('blockiert Arbeit vor dem Lesen und erlaubt den Lesebefehl', () => {
    const root = fixture();
    expect(pretoolDecision({ toolName: 'Grep', toolInput: { pattern: 'x' }, root }).decision).toBe('deny');
    expect(pretoolDecision({ toolName: 'Bash', toolInput: { command: 'pnpm rbd docs read' }, root }).decision).toBe('allow');
    expect(pretoolDecision({ toolName: 'Bash', toolInput: { command: 'pnpm rbd docs read | head' }, root }).decision).toBe('deny');
    expect(pretoolDecision({ toolName: 'Read', toolInput: { file_path: join(root, 'docs/WORKFLOW.md') }, root }).decision).toBe('allow');
  });

  it('laesst nach dem Receipt Arbeit zu, aber keine verlustreiche Gate-Pipe', () => {
    const root = fixture();
    writeReceipt(root);
    expect(pretoolDecision({ toolName: 'Grep', toolInput: { pattern: 'x' }, root }).decision).toBe('allow');
    const pipe = pretoolDecision({ toolName: 'Bash', toolInput: { command: 'pnpm verify light | head' }, root });
    expect(pipe.decision).toBe('deny');
    expect(pipe.reason).toContain('Exit-Status');
  });
});
