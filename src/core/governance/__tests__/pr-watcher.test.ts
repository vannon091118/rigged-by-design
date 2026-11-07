/**
 * @test-target: scripts/pr-watcher.mjs
 * @error-code: ERR-4019
 *
 * Ein erneut aufgetretener Fehler muss ein geschlossenes Issue wieder oeffnen.
 * Der Sweep darf nur mit Original-Fingerprint und Repair-SHA schliessen; ein
 * Vorfahr allein reicht nicht. `origin/main` muss exakt der erfolgreich
 * gepruefte Commit sein.
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

  it('schliesst nicht allein wegen eines Ancestor-Commits ohne Reparaturmarker', async () => {
    const mainSha = 'a'.repeat(40);
    const issueCommit = 'c'.repeat(40);
    const apiCalls: ApiCall[] = [];
    const gitCalls: string[][] = [];
    const api: WatcherApi = async (method, path, body) => {
      apiCalls.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (method === 'GET') {
        return response([{ number: 11, body: `**Commit:** \`${issueCommit}\`\n<!-- fp:ERR-4026:test -->` }]);
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

    expect(gitCalls).toEqual([['rev-parse', 'origin/main']]);
    expect(apiCalls.filter(({ method }) => method === 'PATCH')).toEqual([]);
  });

  it('schliesst mit Fingerprint und Reparatur, die auf dem exakt gruenen Main liegen', async () => {
    const mainSha = 'a'.repeat(40);
    const issueCommit = 'c'.repeat(40);
    const repair = 'd'.repeat(40);
    const apiCalls: ApiCall[] = [];
    const gitCalls: string[][] = [];
    const api: WatcherApi = async (method, path, body) => {
      apiCalls.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (method === 'GET') {
        return response([{
          number: 11,
          body: `**Commit:** \`${issueCommit}\`\n<!-- fp:ERR-4026:test -->\n<!-- repair: ${repair} -->`,
        }]);
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
    expect(gitCalls).toContainEqual(['merge-base', '--is-ancestor', issueCommit, repair]);
    expect(gitCalls).toContainEqual(['merge-base', '--is-ancestor', repair, mainSha]);
    expect(apiCalls).toContainEqual({
      method: 'PATCH',
      path: '/issues/11',
      body: { state: 'closed', state_reason: 'completed' },
    });
    expect(apiCalls.find(({ method }) => method === 'POST')?.body).toMatchObject({
      body: expect.stringContaining('Reparatur'),
    });
  });

  it('laesst den Issue offen, wenn die Reparatur-SHA nicht auf main liegt', async () => {
    const mainSha = 'a'.repeat(40);
    const issueCommit = 'c'.repeat(40);
    const repair = 'd'.repeat(40);
    const apiCalls: ApiCall[] = [];
    const api: WatcherApi = async (method, path, body) => {
      apiCalls.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (method === 'GET') {
        return response([{
          number: 11,
          body: `**Commit:** \`${issueCommit}\`\n<!-- fp:ERR-4026:test -->\n<!-- repair: ${repair} -->`,
        }]);
      }
      return response({});
    };
    const git = (args: string[]) => {
      if (args[0] === 'rev-parse') return mainSha;
      if (args[0] === 'merge-base' && args[2] === repair && args[3] === mainSha) {
        throw new Error('Reparatur nicht auf main');
      }
      if (args[0] === 'merge-base') return '';
      throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`);
    };

    await sweepGreenMain({ api, git, mainSha });

    expect(apiCalls.filter(({ method }) => method === 'PATCH')).toEqual([]);
  });
});

describe('pr-watcher Head-SHA-Body', () => {
  it('schliesst ein Issue auch mit dem neuen Head-SHA-Feld', async () => {
    const mainSha = 'c'.repeat(40);
    const headSha = 'a'.repeat(40);
    const repair = 'd'.repeat(40);
    const calls: ApiCall[] = [];
    const api: WatcherApi = async (method, path, body) => {
      calls.push({ method, path, ...(body === undefined ? {} : { body }) });
      if (method === 'GET') {
        return response([
          {
            number: 9,
            body: `**Branch:** \`lane/x\`\n**Head-SHA:** \`${headSha}\`\n<!-- fp:ERR-4017:docs -->\n<!-- repair: ${repair} -->`,
          },
        ]);
      }
      return response({});
    };
    const git = (args: string[]) => (args[0] === 'rev-parse' ? mainSha : '');

    await sweepGreenMain({ api, git, mainSha });

    const closed = calls.find((call) => call.method === 'PATCH' && call.path === '/issues/9');
    expect(closed?.body).toEqual({ state: 'closed', state_reason: 'completed' });
  });
});
