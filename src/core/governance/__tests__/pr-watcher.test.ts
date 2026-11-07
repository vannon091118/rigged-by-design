/**
 * @test-target: scripts/pr-watcher.mjs
 * @error-code: ERR-4019
 *
 * Ein erneut aufgetretener Fehler muss ein geschlossenes Issue wieder oeffnen.
 * Der Sweep darf nur schliessen, wenn `origin/main` exakt der erfolgreich
 * gepruefte Commit ist; ein Vorfahr in einer neueren origin/main reicht nicht.
 */
import { describe, expect, it } from 'vitest';
import { recordRecurrence, sweepGreenMain } from '../../../../scripts/pr-watcher.mjs';

type WatcherResponse = { ok: boolean; status?: number; json: () => Promise<unknown> };
type WatcherApi = (method: string, path: string, body?: unknown) => Promise<WatcherResponse>;
type ApiCall = { method: string; path: string; body?: unknown };

const response = (data: unknown): WatcherResponse => ({
  ok: true,
  status: 200,
  json: async () => data,
});

describe('pr-watcher', () => {
  it('oeffnet ein geschlossenes Issue bei erneutem Fehler vor dem Kommentar wieder', async () => {
    const calls: ApiCall[] = [];
    const api: WatcherApi = async (method, path, body) => {
      calls.push({ method, path, ...(body === undefined ? {} : { body }) });
      return response(method === 'GET' ? [] : {});
    };

    await recordRecurrence(
      { number: 7, state: 'closed' },
      'https://example.test/actions/runs/1',
      { api },
    );

    expect(calls.map(({ method }) => method)).toEqual(['GET', 'PATCH', 'POST']);
    const reopened = calls.find(({ method }) => method === 'PATCH');
    expect(reopened?.path).toBe('/issues/7');
    expect(reopened?.body).toEqual({ state: 'open', state_reason: 'reopened' });
    const comment = calls.find(({ method }) => method === 'POST');
    expect(comment?.body).toMatchObject({ body: expect.stringContaining('Vorgekommen: 2 mal') });
  });

  it('verweigert den Sweep, wenn origin/main nicht exakt der geprueften SHA ist', async () => {
    const mainSha = 'a'.repeat(40);
    const originMain = 'b'.repeat(40);
    const apiCalls: ApiCall[] = [];
    const gitCalls: string[][] = [];
    const api: WatcherApi = async (method, path, body) => {
      apiCalls.push({ method, path, ...(body === undefined ? {} : { body }) });
      return response([]);
    };
    const git = (args: string[]) => {
      gitCalls.push(args);
      if (args[0] === 'rev-parse') return originMain;
      throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`);
    };

    await sweepGreenMain({ api, git, mainSha });

    expect(apiCalls).toEqual([]);
    expect(gitCalls).toEqual([['rev-parse', 'origin/main']]);
  });

  it('schliesst bei exakt geprueftem Main-SHA nur den Commit auf main', async () => {
    const mainSha = 'a'.repeat(40);
    const issueCommit = 'c'.repeat(40);
    const apiCalls: ApiCall[] = [];
    const gitCalls: string[][] = [];
    const api: WatcherApi = async (method, path, body) => {
      apiCalls.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (method === 'GET') {
        return response([{ number: 11, body: `**Commit:** \`${issueCommit}\`` }]);
      }
      return response({});
    };
    const git = (args: string[]) => {
      gitCalls.push(args);
      if (args[0] === 'rev-parse') return mainSha;
      if (args[0] === 'merge-base') return '';
      throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`);
    };

    await sweepGreenMain({ api, git, mainSha });

    expect(gitCalls).toContainEqual(['merge-base', '--is-ancestor', issueCommit, mainSha]);
    expect(apiCalls).toContainEqual({
      method: 'PATCH',
      path: '/issues/11',
      body: { state: 'closed', state_reason: 'completed' },
    });
  });
});
