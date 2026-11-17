/**
 * @test-target: scripts/verify-output-budget.mjs
 * @test-target-mode: process
 * @error-code: ERR-4019
 *
 * Der Vollscan als Test: die Pflichtliste muss Start, Board, Commit, Verify
 * und Turn-Ende abdecken, jede Datei muss den Budget-Vertrag importieren und
 * `captureConsole` aufrufen, das Gate muss in Light und Quick haengen, und ein
 * echter Gate-Lauf muss gruen sein und selbst unter 500 Token bleiben.
 *
 * Ein neuer Pflicht-Einstiegspunkt ohne Kapselung macht diesen Test rot —
 * genau das ist der Zweck.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRY_POINTS as RAW_ENTRY_POINTS, JSON_ENTRY_POINTS as RAW_JSON_ENTRY_POINTS } from '../../../../scripts/lib/entry-points.mjs';

type Entry = { id: string; file: string; phase: string };
const ENTRY_POINTS = RAW_ENTRY_POINTS as unknown as readonly Entry[];
const JSON_ENTRY_POINTS = RAW_JSON_ENTRY_POINTS as unknown as readonly { id: string; file: string }[];
import { LIGHT_GATES, QUICK_GATES } from '../../../../scripts/lib/pipeline-plan.mjs';

const ROOT = resolve(process.cwd());
const GATE = join(ROOT, 'scripts', 'verify-output-budget.mjs');

function tokensOf(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 3);
}

describe('Pflicht-Einstiegspunkte und Ausgabe-Budget', () => {
  it('deckt jede Phase des Arbeitswegs ab', () => {
    const phases = new Set(ENTRY_POINTS.map((entry) => entry.phase));
    for (const phase of ['turn-start', 'board', 'commit', 'verify', 'turn-end', 'hooks']) {
      expect(phases.has(phase)).toBe(true);
    }
    const ids = ENTRY_POINTS.map((entry) => entry.id);
    for (const required of ['agent:start', 'agent:pretask', 'verify:board', 'verify:claims', 'gov:precommit', 'verify:light', 'ci:local', 'turn:finish']) {
      expect(ids).toContain(required);
    }
  });

  it('kapselt jede Datei ueber den einen Budget-Vertrag', () => {
    for (const entry of ENTRY_POINTS) {
      const source = readFileSync(join(ROOT, entry.file), 'utf8');
      expect(source, `${entry.file} importiert compact.mjs`).toContain("from './lib/compact.mjs'");
      expect(source, `${entry.file} ruft captureConsole`).toContain('captureConsole');
    }
  });

  it('laesst keinen Altpfad mit alter Ausgabe stehen', () => {
    // Protokoll-/Terminalpfade liefern absichtlich JSON oder Shell-Ausgabe;
    // dieselbe Ausnahmeliste steht in scripts/verify-output-budget.mjs.
    const jsonOnly = new Set(['install-webhook.mjs', 'agent-pretool.mjs', 'agent-shell.mjs', 'shell-guard.mjs', 'shell-watch.mjs']);
    for (const name of readdirSync(join(ROOT, 'scripts')).filter((entry) => entry.endsWith('.mjs'))) {
      const source = readFileSync(join(ROOT, 'scripts', name), 'utf8');
      if (!/console\.(log|error)\(|process\.stdout\.write/.test(source)) continue;
      if (jsonOnly.has(name)) continue;
      expect(source.includes('captureConsole'), `scripts/${name} nutzt noch die alte Ausgabe`).toBe(true);
    }
  });

  it('benennt die Ausnahmen als Werkzeugformat', () => {
    expect(JSON_ENTRY_POINTS.length).toBeGreaterThan(0);
    for (const entry of JSON_ENTRY_POINTS) {
      expect(readFileSync(join(ROOT, entry.file), 'utf8')).toContain('--json');
    }
  });

  it('zieht das Gate in Light und Quick mit', () => {
    expect(LIGHT_GATES).toContain('output-budget');
    expect(QUICK_GATES).toContain('output-budget');
  });

  it('laeuft gruen, ohne selbst das Budget zu reissen', () => {
    const result = spawnSync(process.execPath, [GATE, '--probe'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(output).toContain('GRUEN');
    expect(tokensOf(output)).toBeLessThanOrEqual(500);
  });
});
