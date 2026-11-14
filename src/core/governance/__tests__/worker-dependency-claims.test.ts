/**
 * @test-target: scripts/lib/dependency-fingerprint.mjs
 * @error-code: ERR-4027
 *
 * Dependencies werden nur bei geaendertem Fingerprint neu gebaut, aus einem
 * persistenten Store. Der Arbeits-Claim ist von der Identitaet getrennt:
 * `DONE` ist Review, `MERGED` braucht einen SHA, Schliessen ist Maintainer-
 * oder User-Recht.
 */
import { describe, expect, it } from 'vitest';
import {
  dependencyFingerprint, installCommand, planInstall,
} from '../../../../scripts/lib/dependency-fingerprint.mjs';
import {
  canClaimWork, canClose, legacyReleaseMeaning, workState,
} from '../../../../scripts/lib/work-claim.mjs';

/** Autor und Claim-ID sind Pflicht: der Text allein autorisiert nichts (#693). */
const ACTORS = { maintainers: ['maintainer'], users: ['owner'], workers: ['worker'] };
const commentsOf = (...bodies: readonly string[]) =>
  bodies.map((body, index) => ({ id: String(index + 1), author: { login: 'worker' }, body }));

describe('Dependency-Fingerprint', () => {
  const base = {
    manifests: { 'package.json': '{"a":1}' },
    lockfile: 'lock-v1',
    workspaceConfig: '',
    npmrc: '',
    node: '22.0.0',
    pnpm: '10.4.1',
    platform: 'win32',
    arch: 'x64',
    storeDir: 'D:/home/.pnpm-store',
  };

  it('ist stabil gegen Schluesselreihenfolge und sensibel fuer Lockfile', () => {
    const first = dependencyFingerprint(base);
    expect(dependencyFingerprint({ ...base })).toBe(first);
    expect(dependencyFingerprint({ ...base, lockfile: 'lock-v2' })).not.toBe(first);
    expect(dependencyFingerprint({ ...base, node: '23.0.0' })).not.toBe(first);
  });

  it('installiert nur bei echter Abweichung', () => {
    const fingerprint = dependencyFingerprint(base);
    const record = { fingerprint, ok: true };
    expect(planInstall({ previous: record, fingerprint })).toEqual({ install: false, reason: 'reuse' });
    expect(planInstall({ previous: record, fingerprint, installedOk: false }).reason).toBe('node-modules-broken');
    expect(planInstall({ previous: null, fingerprint }).reason).toBe('no-successful-install');
    expect(planInstall({ previous: record, fingerprint: 'andere' }).reason).toBe('fingerprint-changed');
    expect(installCommand({ storeDir: base.storeDir }))
      .toBe('pnpm install --frozen-lockfile --store-dir D:/home/.pnpm-store');
  });
});

describe('Arbeits-Claim', () => {
  it('fuehrt DONE nach REVIEW_PENDING und sperrt neue Arbeit', () => {
    const state = workState(commentsOf(
      'WORK_CLAIM claim_id=wc-1 identity=LIILITH',
      'DONE claim_id=wc-1',
      'REVIEW_PENDING claim_id=wc-1',
    ), { actors: ACTORS });
    expect(state).toBe('REVIEW_PENDING');
    expect(canClaimWork(state)).toBe(false);
    expect(canClaimWork(state, { sameIssue: true })).toBe(true);
  });

  it('laesst nur Maintainer oder User schliessen und nur nach Merge', () => {
    expect(canClose({ role: 'AGENT_ARBEITER', state: 'MERGED' })).toEqual({ ok: false, reason: 'not-authorized' });
    expect(canClose({ role: 'MAINTAINER', state: 'REVIEW_PENDING' })).toEqual({ ok: false, reason: 'merge-proof-missing' });
    expect(canClose({ role: 'MAINTAINER', state: 'MERGED' }).ok).toBe(true);
  });

  it('liest das Legacy-RELEASE nicht mehr als gleichwertige Freigabe', () => {
    expect(legacyReleaseMeaning('RELEASE [A1] done abc1234')).toEqual({ state: 'REVIEW_PENDING', releasesIdentity: false });
    expect(legacyReleaseMeaning('RELEASE [A1] abandoned')).toEqual({ state: 'UNRESOLVED', releasesIdentity: true });
    expect(legacyReleaseMeaning('irgendwas')).toBeNull();
  });
});
