/**
 * @test-target: .cron/lib/lock.mjs
 * @error-code: ERR-4019
 *
 * #835: Der Maintainer-Lock ist ein atomar angelegter Git-Ref. Ein freier Lock
 * hat genau einen Gewinner, parallele Laeufe koennen nicht beide erfolgreich
 * sein, ein abgelaufener Lock wird genau einmal eingesammelt, und freigeben darf
 * nur der Halter mit seiner Claim-ID. API-Fehler bleiben Fehler.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TTL_MS, acquireLock, formatLockRecord, isLockExpired, lockAgeMs, parseLockRecord, releaseLock,
} from '../../../../.cron/lib/lock.mjs';

const T0 = Date.parse('2026-11-15T04:00:00Z');

type Commit = { sha: string; tree: { sha: string }; message: string };

/** In-Memory-GitHub: createRef ist atomar, ein zweiter Anlauf erhaelt 422. */
function memoryApi() {
  const refs = new Map<string, string>();
  const commits = new Map<string, Commit>();
  const mainSha = 'a'.repeat(40);
  commits.set(mainSha, { sha: mainSha, tree: { sha: 'b'.repeat(40) }, message: 'main' });
  refs.set('heads/main', mainSha);
  let counter = 0;
  const api = {
    getRef: async (ref: string) => {
      const sha = refs.get(ref);
      return sha ? { ref, object: { sha } } : null;
    },
    createRef: async (ref: string, sha: string) => {
      const key = ref.replace(/^refs\//, '');
      if (refs.has(key)) throw Object.assign(new Error('GitHub API 422'), { status: 422 });
      refs.set(key, sha);
      return { ref: key, object: { sha } };
    },
    deleteRef: async (ref: string) => {
      refs.delete(ref.replace(/^refs\//, ''));
      return null;
    },
    getCommit: async (sha: string) => {
      const commit = commits.get(sha);
      if (!commit) throw Object.assign(new Error('GitHub API 404'), { status: 404 });
      return commit;
    },
    createCommit: async (input: { message: string; tree: string; parents: readonly string[]; date: string }) => {
      counter += 1;
      const sha = String(counter).padStart(40, 'c');
      const commit = { sha, tree: { sha: input.tree }, message: input.message };
      commits.set(sha, commit);
      return commit;
    },
  };
  return { api, refs };
}

describe('Cron-Lock (#835)', () => {
  it('reserviert bei freiem Lock genau einmal', async () => {
    const { api } = memoryApi();
    const first = await acquireLock({ api, owner: 'a', claimId: 'c1', now: T0 });
    expect(first.status).toBe('acquired');
    const second = await acquireLock({ api, owner: 'b', claimId: 'c2', now: T0 + 1000 });
    expect(second).toMatchObject({ status: 'busy', holder: { owner: 'a', claimId: 'c1' } });
  });

  it('laesst parallele Anfragen nicht beide gewinnen', async () => {
    const { api } = memoryApi();
    const results = await Promise.all([
      acquireLock({ api, owner: 'a', claimId: 'c1', now: T0 }),
      acquireLock({ api, owner: 'b', claimId: 'c2', now: T0 }),
    ]);
    expect(results.filter((entry: { status: string }) => entry.status === 'busy')).toHaveLength(1);
    expect(results.filter((entry: { status: string }) => entry.status !== 'busy')).toHaveLength(1);
  });

  it('sammelt einen abgelaufenen Lock einmal ein', async () => {
    const { api } = memoryApi();
    await acquireLock({ api, owner: 'a', claimId: 'c1', now: T0 });
    const stillBusy = await acquireLock({ api, owner: 'b', claimId: 'c2', now: T0 + DEFAULT_TTL_MS - 1 });
    expect(stillBusy.status).toBe('busy');
    const takenOver = await acquireLock({ api, owner: 'b', claimId: 'c2', now: T0 + DEFAULT_TTL_MS });
    expect(takenOver).toMatchObject({ status: 'acquired-after-stale', record: { owner: 'b' } });
  });

  it('gibt nur der Halter mit seiner Claim-ID frei', async () => {
    const { api, refs } = memoryApi();
    await acquireLock({ api, owner: 'a', claimId: 'c1', now: T0 });
    expect((await releaseLock({ api, owner: 'b', claimId: 'c1' })).status).toBe('not-holder');
    expect((await releaseLock({ api, owner: 'a', claimId: 'c2' })).status).toBe('not-holder');
    expect(refs.has('heads/rbd-lock/maintainer-cron')).toBe(true);
    expect((await releaseLock({ api, owner: 'a', claimId: 'c1' })).status).toBe('released');
    expect(refs.has('heads/rbd-lock/maintainer-cron')).toBe(false);
    expect((await releaseLock({ api, owner: 'a', claimId: 'c1' })).status).toBe('not-locked');
  });

  it('liest und schreibt nur eigene Lock-Records', () => {
    const record = { owner: 'a', claimId: 'c1', at: '2026-11-15T04:00:00Z' };
    expect(parseLockRecord(formatLockRecord(record))).toEqual(record);
    expect(parseLockRecord('{"owner":"a"}')).toBeNull();
    expect(parseLockRecord('kein json')).toBeNull();
    expect(isLockExpired(record, T0 + 60_000, 30_000)).toBe(true);
    expect(isLockExpired(record, T0 + 29_000, 30_000)).toBe(false);
    expect(lockAgeMs(record, T0)).toBe(0);
  });

  it('meldet API-Fehler statt sie zu schlucken', async () => {
    const { api } = memoryApi();
    const failing = {
      ...api,
      getRef: async () => { throw Object.assign(new Error('HTTP 500'), { status: 500 }); },
    };
    await expect(acquireLock({ api: failing, owner: 'a', claimId: 'c1', now: T0 }))
      .rejects.toMatchObject({ status: 500 });
  });
});
