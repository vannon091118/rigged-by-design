/**
 * @test-target: scripts/lib/worker-identity.mjs
 * @error-code: ERR-4027
 *
 * Identitaet ist ein Betriebsmittel: drei Namen, exklusive Reservierung mit
 * Kommentar-ID, Freigabe nur mit derselben Claim-ID, Legacy-Namen als Historie.
 * Die lokale Datei liegt im Workspace-Home und wird nur dort geschrieben.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  WORKER_IDENTITIES, dispatchRole, formatIdentityClaim, formatIdentityRelease,
  isLegacyIdentity, nextFreeIdentity, parseIdentityEvents, resolveReservations,
} from '../../../../scripts/lib/worker-identity.mjs';
import {
  createIdentityRecord, isInsideRepository, validateIdentityFile,
  workspacePaths, writeIdentityFile,
} from '../../../../scripts/lib/workspace-home.mjs';

const claimLine = (overrides = {}) => formatIdentityClaim({
  name: 'LIILITH', system: 'sys-1', workspace: 'ws-1',
  repo: 'vannon091118/rigged-by-design', session: 'sess-1', claimId: 'idc-1',
  at: '2026-11-14T00:00:00Z', ...overrides,
});

const commentsOf = (...bodies: readonly string[]) =>
  bodies.map((body, index) => ({ id: String(index + 1), body }));

const cleanup: string[] = [];
afterEach(() => {
  for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('Worker-Identitaet', () => {
  it('kennt genau drei Namen und behandelt Legacy-Namen als Historie', () => {
    expect([...WORKER_IDENTITIES]).toEqual(['LIILITH', 'Shinon', 'Jenova']);
    expect(isLegacyIdentity('agent-1-local')).toBe(true);
    expect(isLegacyIdentity('agent-2-cloud')).toBe(true);
    expect(isLegacyIdentity('LIILITH')).toBe(false);
  });

  it('dispatcht standardmaessig den Worker und nur auf Auftrag den Maintainer', () => {
    expect(dispatchRole()).toBe('AGENT_ARBEITER');
    expect(dispatchRole({ userRequestedMaintainer: true })).toBe('MAINTAINER');
  });

  it('reserviert exklusiv und meldet den zweiten Workspace als Konflikt', () => {
    const { reserved, conflicts } = resolveReservations(commentsOf(
      claimLine(), claimLine({ workspace: 'ws-2', claimId: 'idc-2' }),
    ));
    expect(reserved).toHaveLength(1);
    expect(reserved[0]!.workspace).toBe('ws-1');
    expect(conflicts.map((entry: { reason: string }) => entry.reason)).toContain('exclusive-claim');
  });

  it('gibt nur mit derselben Claim-ID frei', () => {
    const wrong = resolveReservations(commentsOf(claimLine(), formatIdentityRelease({
      name: 'LIILITH', system: 'sys-1', workspace: 'ws-1', session: 'sess-1', claimId: 'idc-x', reason: 'done',
    })));
    expect(wrong.reserved).toHaveLength(1);
    expect(wrong.conflicts.map((entry: { reason: string }) => entry.reason)).toContain('release-claim-mismatch');

    const right = resolveReservations(commentsOf(claimLine(), formatIdentityRelease({
      name: 'LIILITH', system: 'sys-1', workspace: 'ws-1', session: 'sess-1', claimId: 'idc-1', reason: 'done',
    })));
    expect(right.reserved).toHaveLength(0);
    expect(right.free).toContain('LIILITH');
  });

  it('verwirft unvollstaendige Claims und unbekannte Namen', () => {
    const legacy = 'IDENTITY_CLAIM name=agent-1-local system=sys-1 workspace=ws-1 repo=r session=s claim_id=idc-legacy at=t';
    const comments = commentsOf(
      'IDENTITY_CLAIM name=Shinon system=sys-1',
      legacy,
      claimLine({ name: 'Jenova', claimId: 'idc-3' }),
    );
    const { events, invalid } = parseIdentityEvents(comments);
    expect(invalid).toHaveLength(1);
    expect(events).toHaveLength(2);
    const state = resolveReservations(comments);
    expect(state.conflicts.map((entry: { reason: string }) => entry.reason)).toContain('legacy-identity');
    expect(state.free).toEqual(['LIILITH', 'Shinon']);
  });

  it('gibt die naechste freie Identitaet und keine vierte', () => {
    expect(nextFreeIdentity(commentsOf(
      claimLine(), claimLine({ name: 'Shinon', claimId: 'idc-2' }), claimLine({ name: 'Jenova', claimId: 'idc-3' }),
    ))).toBeNull();
  });
});

describe('Workspace-Home', () => {
  it('baut feste Pfade ausserhalb beider Worktrees', () => {
    const home = join(tmpdir(), 'rbd-home');
    const paths = workspacePaths(home);
    expect(paths.identity).toBe(join(home, '.lanes', 'identity.json'));
    expect(paths.store).toBe(join(home, '.pnpm-store'));
    expect(paths.main).toBe(join(home, 'main'));
    expect(paths.worker).toBe(join(home, 'worker'));
  });

  it('lehnt eine Identitaetsdatei im Repository ab', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-repo-'));
    cleanup.push(root);
    const record = createIdentityRecord({
      identity: 'LIILITH', systemId: 'sys-1', workspaceId: 'ws-1',
      repository: 'vannon091118/rigged-by-design', sessionId: 'sess-1', claimId: 'idc-1',
      commentRef: 'https://github.com/x/y/issues/1#issuecomment-1',
      reservedAt: '2026-11-14T00:00:00Z', mainSha: 'abc1234', status: 'ACTIVE',
    });
    expect(isInsideRepository(join(root, '.lanes', 'identity.json'), root)).toBe(true);
    expect(() => writeIdentityFile(join(root, '.lanes', 'identity.json'), record, { repoRoot: root })).toThrow();
    const outside = mkdtempSync(join(tmpdir(), 'rbd-home-'));
    cleanup.push(outside);
    expect(() => writeIdentityFile(join(outside, 'identity.json'), record)).not.toThrow();
  });

  it('meldet fehlende Pflichtfelder konkret', () => {
    const record = createIdentityRecord({
      identity: 'agent-7-local', systemId: 'sys-1', workspaceId: '', repository: 'r',
      sessionId: 's', claimId: 'c', commentRef: 'ref', reservedAt: 't', mainSha: 'sha', status: 'ACTIVE',
    });
    const validation = validateIdentityFile(record);
    expect(validation.ok).toBe(false);
    expect(validation.reasons).toEqual(expect.arrayContaining(['identity-unknown', 'workspace-missing']));
  });
});
