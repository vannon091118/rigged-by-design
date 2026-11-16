/**
 * @test-target: scripts/lib/repair-plan.mjs
 * @error-code: ERR-0911
 *
 * Die Reihenfolge der Reparatur-Auswertung ist der Vertrag: NOOP/PR_HANDOFF erzeugen nichts, ein
 * transienter Befund wird genau einmal wiederholt, ein mechanischer Befund
 * wird im temporaeren Worktree repariert, erst danach entsteht ein Issue.
 * Ausserhalb der Allowlist bricht die Reparatur ab, ohne zu committen.
 */
import { describe, expect, it } from 'vitest';
import {
  affectedGates,
  filterPaths,
  isMechanicalPath,
  planResolution,
  repairAttemptAllowed,
} from '../../../../scripts/lib/repair-plan.mjs';

const sha = 'a'.repeat(40);

const mechanical = [{ code: 'ERR-4017', level: 'AGENT', step: 'Gate docs', line: 'Doku-Marker fehlt' }];

describe('repair-plan Reihenfolge', () => {
  it('prueft in NOOP und PR_HANDOFF nichts', () => {
    expect(planResolution({ state: 'NOOP', branch: 'lane/x/y', failures: mechanical }).action).toBe('none');
    expect(planResolution({ state: 'PR_HANDOFF', branch: 'lane/x/y', failures: mechanical }).action).toBe('none');
  });

  it('wiederholt einen transienten Befund genau einmal', () => {
    const transient = [{ code: 'ERR-4014', level: 'REMOTE_CI', step: 'Gate tests' }];
    expect(planResolution({ branch: 'lane/x/y', failures: transient, attempts: 1 }).action).toBe('rerun');
    expect(planResolution({ branch: 'lane/x/y', failures: transient, attempts: 2 }).action).toBe('none');
  });

  it('repariert nur mechanische Befunde und nennt die betroffenen Gates', () => {
    const decision = planResolution({ branch: 'lane/x/y', failures: mechanical, sha });
    expect(decision.action).toBe('repair');
    expect(decision.gates).toEqual(['docs']);
    expect(decision.paths).toContain('docs/INVENTORY.md');
    expect(decision.marker).toBe(`<!-- autofix: ${sha} -->`);
    expect(affectedGates(mechanical)).toEqual(['docs']);
  });

  it('macht aus einem fachlichen Befund sofort ein Issue', () => {
    const decision = planResolution({
      branch: 'lane/x/y',
      failures: [{ code: 'ERR-2001', level: 'BLOCKED', step: 'Gate tests' }],
      sha,
    });
    expect(decision.action).toBe('issue');
  });

  it('repariert nie auf main und nie in einem Fork', () => {
    expect(planResolution({ branch: 'main', failures: mechanical, sha }).action).toBe('issue');
    expect(planResolution({ branch: 'lane/x/y', sameRepo: false, failures: mechanical, sha }).action).toBe('issue');
    expect(planResolution({ branch: 'lane/x/y', fork: true, failures: mechanical, sha }).action).toBe('issue');
  });

  it('erlaubt nur einen Versuch pro SHA', () => {
    const body = `<!-- autofix: ${sha} -->`;
    expect(repairAttemptAllowed({ body, sha, attempts: 1 })).toBe(false);
    expect(planResolution({ branch: 'lane/x/y', failures: mechanical, sha, body }).action).toBe('issue');
    expect(repairAttemptAllowed({ sha: 'kein-sha' })).toBe(false);
  });
});

describe('repair-plan Allowlist', () => {
  it('akzeptiert nur Doku-Marker, Matrix, Katalog und Inventur', () => {
    expect(isMechanicalPath('docs/INVENTORY.md')).toBe(true);
    expect(isMechanicalPath('docs/ARCHITECTURE.md')).toBe(true);
    expect(isMechanicalPath('docs/CHANGELOG.md')).toBe(true);
    expect(isMechanicalPath('src/core/foo.ts')).toBe(false);
    expect(isMechanicalPath('scripts/run-pipeline.mjs')).toBe(false);
  });

  it('bricht bei einem fremden Pfad ab', () => {
    const mixed = filterPaths(['docs/INVENTORY.md', 'src/core/foo.ts']);
    expect(mixed.ok).toBe(false);
    expect(mixed.allowed).toEqual(['docs/INVENTORY.md']);
    expect(mixed.foreign).toEqual(['src/core/foo.ts']);
  });
});

