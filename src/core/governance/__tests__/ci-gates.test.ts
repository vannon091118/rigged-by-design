/**
 * @test-target: .github/workflows/ci-verify.yml
 * @error-code: ERR-4008
 *
 * Ebene A des Main-Gates: `main` ist kein Sonderfall mehr, und der
 * Release-Workflow kennt keine Nachricht, die seine Pruefung abschaltet.
 * Ebene B (Ruleset, Pflichtstatus) ist eine GitHub-Einstellung; sie wird in
 * docs/CI-GATES.md beschrieben und von `npm run verify` nicht erzwungen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = (name: string): string =>
  readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8');

describe('Main-Gate', () => {
  it('prueft Pushes auf main und Pull Requests gegen main', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci).not.toMatch(/branches-ignore/);
    expect(ci).toMatch(/pull_request:/);
    expect(ci).toMatch(/push:/);
    expect(ci).toMatch(/branches: \['\*\*'\]/);
    expect(ci).toMatch(/name: Fail-Closed Gates/);
  });

  it('prueft vor dem Tag und kennt keine Nachrichten-Bedingung', () => {
    const release = workflow('auto-version-release.yml');
    expect(release).not.toMatch(/head_commit\.message/);
    const verified = release.indexOf('npm run verify:release');
    const tagged = release.indexOf('ci-tag-release.mjs');
    expect(verified).toBeGreaterThan(-1);
    expect(tagged).toBeGreaterThan(verified);
  });

  it('startet den Verify-Workflow auch von Hand', () => {
    expect(workflow('ci-verify.yml')).toMatch(/workflow_dispatch:/);
  });
});
