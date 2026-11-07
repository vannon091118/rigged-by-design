/**
 * @test-target: scripts/lib/lane-claims.mjs
 * @error-code: ERR-4019
 *
 * Ein Claim ist der Vertrag einer Lane, kein Token pro Pull Request. Nach dem
 * Merge muss die Lane ihren Branch fuer einen Register-Nachtrag weiterfuehren
 * koennen, ohne einen neuen Claim anzulegen - sonst stuende nach jedem Merge
 * genau ein offener Claim mit bereits gemergtem PR im Register.
 */
import { describe, expect, it } from 'vitest';
import {
  auditClaimChange,
  auditRegisterAgainstBase,
  patternCoveredBy,
  selectClaim,
} from '../../../../scripts/lib/lane-claims.mjs';

const open = { id: 'lane/x/offen', branch: 'lane/x/offen', status: 'open' };
const merged = { id: 'lane/x/gemergt', branch: 'lane/x/gemergt', status: 'merged' };

describe('lane-claims claim selection', () => {
  it('waehlt den offenen Claim einer Lane', () => {
    expect(selectClaim([open, merged], 'lane/x/offen')).toBe(open);
  });

  it('fuehrt eine gemergte Lane unter ihrem Claim weiter', () => {
    expect(selectClaim([open, merged], 'lane/x/gemergt')).toBe(merged);
  });

  it('liefert ohne Claim null und damit fail-closed', () => {
    expect(selectClaim([open, merged], 'lane/x/unbekannt')).toBeNull();
  });
});

type ClaimShape = {
  id: string;
  branch: string;
  owner: string;
  status: string;
  pathAllowlist: string[];
  contracts: { id: string; mode: string }[];
};

const makeClaim = (patch: Partial<ClaimShape> = {}): ClaimShape => ({
  id: 'lane/feature/demo',
  branch: 'lane/feature/demo',
  owner: 'Integrator',
  status: 'open',
  pathAllowlist: ['src/core/**'],
  contracts: [],
  ...patch,
});

describe('claim register trust', () => {
  it('akzeptiert eine unveraenderte Allowlist', () => {
    expect(auditClaimChange(makeClaim(), makeClaim()).ok).toBe(true);
  });

  it('lehnt eine erweiterte eigene Allowlist ab', () => {
    const widened = makeClaim({ pathAllowlist: ['src/core/**', '.github/workflows/ci-verify.yml'] });
    expect(auditClaimChange(makeClaim(), widened).violations.join(' ')).toContain('Allowlist erweitert');
  });

  it('erlaubt eine verengte Allowlist', () => {
    const narrowed = makeClaim({ pathAllowlist: ['src/core/economy/**'] });
    expect(auditClaimChange(makeClaim(), narrowed).ok).toBe(true);
  });

  it('lehnt das Wiedereroeffnen eines gemergten Claims ab', () => {
    const reopened = makeClaim({ status: 'open' });
    expect(auditClaimChange(makeClaim({ status: 'merged' }), reopened).ok).toBe(false);
  });

  it('laesst die Kontrollebene nur fuer Governance- oder CI-Lanes zu', () => {
    const feature = makeClaim({ pathAllowlist: ['scripts/promote.mjs'] });
    const governance = makeClaim({ id: 'lane/governance/demo', pathAllowlist: ['scripts/promote.mjs'] });
    expect(auditClaimChange(null, feature).ok).toBe(false);
    expect(auditClaimChange(null, governance).ok).toBe(true);
  });

  it('meldet fremde Claim-Aenderungen in einer Feature-Lane', () => {
    const foreign = makeClaim({ id: 'lane/other/demo', branch: 'lane/other/demo' });
    const changed = { ...foreign, pathAllowlist: ['src/core/**', 'scripts/promote.mjs'] };
    const result = auditRegisterAgainstBase({
      baseClaims: [foreign],
      nextClaims: [changed, makeClaim()],
      branch: 'lane/feature/demo',
    });
    expect(result.ok).toBe(false);
  });

  it('erlaubt einer Governance-Lane den Statuswechsel eines fremden Claims', () => {
    const foreign = makeClaim({ id: 'lane/other/demo', branch: 'lane/other/demo' });
    const mergedForeign = { ...foreign, status: 'merged' };
    const own = makeClaim({ id: 'lane/governance/demo', branch: 'lane/governance/demo' });
    const result = auditRegisterAgainstBase({
      baseClaims: [foreign],
      nextClaims: [mergedForeign, own],
      branch: 'lane/governance/demo',
    });
    expect(result.ok).toBe(true);
  });

  it('prueft Abdeckung in beide Richtungen', () => {
    expect(patternCoveredBy('scripts/promote.mjs', ['scripts/'])).toBe(true);
    expect(patternCoveredBy('scripts/**', ['scripts/promote.mjs'])).toBe(false);
  });
});
