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
  botAllowlist,
  botClaim,
  findCollisions,
  patternCoveredBy,
  selectClaim,
  validateNewClaim,
} from '../../../../scripts/lib/lane-claims.mjs';

const open = { id: 'lane/x/offen', branch: 'lane/x/offen', status: 'open' };
const merged = { id: 'lane/x/gemergt', branch: 'lane/x/gemergt', status: 'merged' };

describe('bot branches', () => {
  it('laesst Dependabot nur Abhaengigkeitsartefakte schreiben', () => {
    const claim = botClaim('dependabot/npm_and_yarn/react-19');
    expect(claim?.allowsPath('package.json')).toBe(true);
    expect(claim?.allowsPath('pnpm-lock.yaml')).toBe(true);
    expect(claim?.allowsPath('.github/workflows/ci-verify.yml')).toBe(true);
    expect(claim?.allowsPath('src/core/economy.ts')).toBe(false);
    expect(claim?.allowsPath('AGENTS.md')).toBe(false);
    expect(claim?.allowsPath('scripts/promote.mjs')).toBe(false);
  });

  it('gibt normalen Lanes keine Bot-Ausnahme', () => {
    expect(botAllowlist('lane/feature/demo')).toBeNull();
    expect(botClaim('lane/feature/demo')).toBeNull();
    expect(botClaim('dependabot-helper')).toBeNull();
  });
});

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
  task: string;
  baseSha: string;
  gateProfile: string;
  pathAllowlist: string[];
  contracts: { id: string; mode: string }[];
};

const makeClaim = (patch: Partial<ClaimShape> = {}): ClaimShape => ({
  id: 'lane/feature/demo',
  branch: 'lane/feature/demo',
  owner: 'Integrator',
  status: 'open',
  task: 'Feature bauen',
  baseSha: 'a'.repeat(40),
  gateProfile: 'light',
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

  it('prueft fremde Claims gegen die Basis, nicht gegen die eigene Registrierung', () => {
    const foreign = makeClaim({ id: 'lane/other/demo', branch: 'lane/other/demo' });
    const own = makeClaim();
    const result = auditRegisterAgainstBase({
      baseClaims: [foreign],
      registrationClaims: [own],
      nextClaims: [foreign, own],
      branch: 'lane/feature/demo',
    });
    expect(result.ok).toBe(true);
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

  it('validiert neue Feature-Claims ohne Kontrollebene und Governance-Meta', () => {
    const valid = makeClaim({
      task: 'Feature bauen',
      baseSha: 'a'.repeat(40),
      gateProfile: 'light',
      pathAllowlist: ['src/core/**', 'package.json', 'docs/INVENTORY.md'],
    });
    expect(validateNewClaim(valid).ok).toBe(true);
    expect(validateNewClaim({ ...valid, pathAllowlist: ['scripts/promote.mjs'] }).ok).toBe(false);
    expect(validateNewClaim({ ...valid, pathAllowlist: ['AGENTS.md'] }).ok).toBe(false);
    expect(validateNewClaim({ ...valid, pathAllowlist: ['docs/CHANGELOG.md'] }).ok).toBe(false);
    expect(validateNewClaim({ ...valid, pathAllowlist: [] }).ok).toBe(false);
    expect(validateNewClaim({ ...valid, task: '' }).ok).toBe(false);
  });

  it('laesst Governance-Claims Kontrollebene und Meta-Dateien fuehren', () => {
    const governance = makeClaim({
      id: 'lane/governance/demo',
      branch: 'lane/governance/demo',
      task: 'Governance',
      baseSha: 'b'.repeat(40),
      gateProfile: 'light',
      pathAllowlist: ['scripts/**', 'AGENTS.md', 'docs/ARCHITECTURE.md'],
    });
    expect(validateNewClaim(governance).ok).toBe(true);
  });

  it('ignoriert Register, Meta und mechanische Pfade als Kollision', () => {
    const shared = [
      '.lane-claims/claims.json',
      '.lane-claims/claims/lane-a.json',
      'AGENTS.md',
      'docs/ARCHITECTURE.md',
      'package.json',
      'pnpm-lock.yaml',
      'docs/INVENTORY.md',
    ];
    const a = makeClaim({ id: 'lane/a/demo', pathAllowlist: shared });
    const b = makeClaim({ id: 'lane/b/demo', branch: 'lane/b/demo', pathAllowlist: shared });
    expect(findCollisions(a, [b])).toEqual([]);
  });

  it('meldet echte Content-Ueberschneidungen weiter', () => {
    const a = makeClaim({ id: 'lane/a/demo', pathAllowlist: ['src/core/**'] });
    const b = makeClaim({ id: 'lane/b/demo', branch: 'lane/b/demo', pathAllowlist: ['src/core/economy.ts'] });
    expect(findCollisions(a, [b])).toHaveLength(1);
  });

  it('erlaubt Governance fremde Claims nur im Status zu aendern', () => {
    const foreign = makeClaim({ id: 'lane/other/demo', branch: 'lane/other/demo' });
    const own = makeClaim({ id: 'lane/governance/demo', branch: 'lane/governance/demo' });
    const contractChange = { ...foreign, pathAllowlist: ['src/core/**', 'scripts/promote.mjs'] };
    const result = auditRegisterAgainstBase({
      baseClaims: [foreign],
      nextClaims: [contractChange, own],
      branch: 'lane/governance/demo',
    });
    expect(result.ok).toBe(false);
    expect(result.violations.join(' ')).toContain('nur im Status');
  });
});
