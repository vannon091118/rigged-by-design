/**
 * @test-target: .github/workflows/ensure-pr.yml
 * @error-code: ERR-4008
 *
 * Local-only: Kein GitHub-Workflow fuehrt Tests, Gates, Builds oder APKs aus.
 * Die Testlinie laeuft ausschliesslich ueber den lokalen Runner; die
 * verbliebenen Workflows sind reine Repository-Verwaltung.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const workflowDir = resolve(root, '.github', 'workflows');
const workflowFiles = (): string[] => readdirSync(workflowDir).filter((file) => file.endsWith('.yml')).sort();
const localRunner = readFileSync(resolve(root, 'scripts', 'local-ci.mjs'), 'utf8');
const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts as Record<string, string>;

describe('Lokale Testlinie statt Cloud-Runner', () => {
  it('enthaelt keinen Workflow fuer Tests, Build oder APK', () => {
    const files = workflowFiles();
    expect(files).toEqual(['ensure-pr.yml', 'pr-cleanup.yml', 'promote.yml']);
    for (const file of files) {
      const text = readFileSync(resolve(workflowDir, file), 'utf8');
      const commands = text.split(/\r?\n/).filter((line) => /^\s*run:/.test(line)).join('\n');
      expect(commands, `${file} fuehrt noch Tests aus`).not.toMatch(/verify:|pnpm run|android:apk|version-bump/);
    }
    expect(existsSync(resolve(workflowDir, 'ci-verify.yml'))).toBe(false);
    expect(existsSync(resolve(workflowDir, 'long-checks.yml'))).toBe(false);
  });

  it('fuehrt die gesamte Linie lokal aus', () => {
    expect(localRunner).toContain('run-pipeline.mjs');
    expect(localRunner).toContain('prepare-android.mjs');
    expect(scripts['ci:local']).toBe('node scripts/local-ci.mjs');
    expect(scripts['test:mechanics']).toBe('node scripts/local-ci.mjs --profile=mechanics');
    expect(scripts['verify:all']).toBe('node scripts/run-pipeline.mjs --profile=full');
  });

  it('haelt Mechanik aus jedem Regelprofil', () => {
    expect(localRunner).not.toContain('ci-long-checks');
    expect(localRunner).toContain('mechanics');
    expect(scripts['ci:long']).toBe('pnpm run test:mechanics');
  });
});
