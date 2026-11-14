/**
 * @test-target: scripts/lib/lane-claims.mjs
 * @error-code: ERR-4019
 *
 * Das Issue-Board ist die Wahrheit ueber Auftrag und Besitz. Eine neue, offene
 * Lane ohne Issue-Nummer ist kein Legacy-Fall: sie haette keinen Auftrag, keine
 * Prioritaet und keinen Board-Kommentar. Abgeschlossene Bestands-Claims bleiben
 * lesbar, damit alte Lanes nicht nachtraeglich migriert werden muessen (#635).
 */
import { describe, expect, it } from 'vitest';
import { auditRegisterAgainstBase, validateNewClaim } from '../../../../scripts/lib/lane-claims.mjs';

const claim = (patch: Record<string, unknown> = {}) => ({
  id: 'lane/feature/demo',
  branch: 'lane/feature/demo',
  owner: 'Integrator',
  issue: 635,
  status: 'open',
  task: 'Feature bauen',
  baseSha: 'a'.repeat(40),
  gateProfile: 'light',
  pathAllowlist: ['src/core/**'],
  contracts: [],
  ...patch,
});

describe('Neue Lanes brauchen eine Issue-Nummer (#635)', () => {
  it('verlangt fuer jede neue offene Lane eine positive Issue-Nummer', () => {
    expect(validateNewClaim(claim()).ok).toBe(true);
    expect(validateNewClaim(claim({ issue: undefined })).violations.join(' ')).toContain('issue fehlt');
    for (const issue of [0, -3, 2.5]) expect(validateNewClaim(claim({ issue })).ok).toBe(false);
  });

  it('liest historische Claims ohne Issue als Legacy weiter', () => {
    expect(validateNewClaim(claim({ issue: undefined }), { legacy: true }).ok).toBe(true);
    expect(validateNewClaim(claim({ issue: undefined, status: 'merged' })).ok).toBe(true);
  });

  it('blockiert eine neue fremde Lane ohne Issue im Governance-Register', () => {
    const foreign = claim({ id: 'lane/other/ohne-issue', branch: 'lane/other/ohne-issue', issue: undefined });
    const own = claim({ id: 'lane/governance/demo', branch: 'lane/governance/demo' });
    const result = auditRegisterAgainstBase({ baseClaims: [], nextClaims: [foreign, own], branch: 'lane/governance/demo' });
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('issue fehlt');
  });
});
