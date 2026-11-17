/**
 * @test-target: scripts/lib/lane-claims.mjs
 * @error-code: ERR-4019
 *
 * Der Claim-Vertrag folgt dem Doku-Kern: die vier inhaltlichen Kern-Dokus sind
 * governance-geschuetzt, Last Changes ist gemeinsame Ablage ohne Kollision.
 */
import { describe, expect, it } from 'vitest';
import {
  findCollisions,
  META_FILES,
  validateNewClaim,
} from '../../../../scripts/lib/lane-claims.mjs';

type Claim = {
  id: string;
  branch: string;
  owner: string;
  issue: number | null;
  status: string;
  task: string;
  baseSha: string;
  gateProfile: string;
  pathAllowlist: string[];
};

const claim = (patch: Partial<Claim> = {}): Claim => ({
  id: 'lane/feature/demo',
  branch: 'lane/feature/demo',
  owner: 'Integrator',
  issue: 635,
  status: 'open',
  task: 'Doku',
  baseSha: 'a'.repeat(40),
  gateProfile: 'light',
  pathAllowlist: ['src/core/**'],
  ...patch,
});

describe('claim doc core', () => {
  it('schuetzt die inhaltlichen Kern-Dokus und teilt Last Changes', () => {
    expect(META_FILES).toEqual(
      expect.arrayContaining(['AGENTS.md', 'docs/INDEX.md', 'docs/WORKFLOW.md', 'docs/ROADMAP.md']),
    );
    expect(META_FILES).not.toContain('docs/LAST-CHANGES.md');
    expect(validateNewClaim(claim({ pathAllowlist: ['docs/INDEX.md'] })).ok).toBe(false);
    expect(validateNewClaim(claim({ pathAllowlist: ['docs/WORKFLOW.md'] })).ok).toBe(false);
    expect(validateNewClaim(claim({ pathAllowlist: ['docs/LAST-CHANGES.md'] })).ok).toBe(true);
    const governance = claim({
      id: 'lane/governance/docs',
      branch: 'lane/governance/docs',
      pathAllowlist: ['docs/INDEX.md', 'docs/WORKFLOW.md', 'AGENTS.md'],
    });
    expect(validateNewClaim(governance).ok).toBe(true);
  });

  it('ignoriert die gemeinsame Last-Changes-Zeile als Kollision', () => {
    const a = claim({ id: 'lane/a/demo', pathAllowlist: ['docs/LAST-CHANGES.md'] });
    const b = claim({
      id: 'lane/b/demo',
      branch: 'lane/b/demo',
      pathAllowlist: ['docs/LAST-CHANGES.md'],
    });
    expect(findCollisions(a, [b])).toEqual([]);
  });
});
