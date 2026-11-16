/**
 * @test-target: scripts/lib/pipeline-plan.mjs
 * @error-code: ERR-4019
 *
 * FREEZE-0 (#684): Die vier Repository-Workflows sind entfernt. Ihre
 * Restfunktionen gehoeren den Maintainer-/Worker-Laeufen, nicht Actions.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const NAMES = ['ensure-pr.yml', 'pr-cleanup.yml', 'promote.yml', 'board-overview.yml'];

describe('Workflows sind entfernt', () => {
  it('enthaelt keine der vier Workflow-Dateien', () => {
    for (const name of NAMES) {
      expect(existsSync(join(WORKFLOWS, name)), name).toBe(false);
    }
  });

  it('enthaelt ueberhaupt keine Workflow-Datei mehr', () => {
    const files = existsSync(WORKFLOWS) ? readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')) : [];
    expect(files).toEqual([]);
  });

  it('verweist in Skripten nicht mehr auf die Dateinamen', () => {
    const scripts = readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs'));
    for (const file of scripts) {
      const text = readFileSync(join(ROOT, 'scripts', file), 'utf8');
      for (const name of NAMES) expect(text.includes(name), `${file} -> ${name}`).toBe(false);
    }
  });
});
