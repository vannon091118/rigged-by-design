/**
 * Minimaler GitHub-Client fuer den Maintainer-Lock (#835).
 *
 * Jede Antwort ist ein Status: nur 2xx gilt als Erfolg, 4xx wird ohne Retry als
 * `ApiError` gemeldet (damit ein 422 = "Ref existiert" unterscheidbar bleibt),
 * Netz- und 5xx-Fehler werden kontrolliert wiederholt.
 */
import { request as httpsRequest } from 'node:https';

const DEFAULT_API = 'https://api.github.com/repos/vannon091118/rigged-by-design';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

export class ApiError extends Error {
  constructor(status, method, path, detail) {
    super(`GitHub API ${status} bei ${method} ${path}${detail ? `: ${detail}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send({ api, token, method, path, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const request = httpsRequest(new URL(`${api}${path}`), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'rbd-maintainer-cron',
        ...(payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
      },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve({ status: Number(response.statusCode ?? 0), data }));
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

/** Einen Pfad bauen, ohne doppelte oder fehlende Schraegstriche. */
const pathOf = (...parts) => `/${parts.join('/').replace(/^\/+/, '')}`;

export function createClient({
  token, api = DEFAULT_API, maxAttempts = MAX_ATTEMPTS, retryDelayMs = RETRY_DELAY_MS,
} = {}) {
  if (!token) throw new Error('GITHUB_TOKEN nicht gesetzt');

  async function call(method, path, body) {
    let lastError = 'unbekannt';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { status, data } = await send({ api, token, method, path, body });
        if (status >= 200 && status < 300) return data ? JSON.parse(data) : null;
        if (status < 500 && status !== 429) throw new ApiError(status, method, path, data.slice(0, 200));
        lastError = `HTTP ${status}`;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        lastError = error instanceof Error ? error.message : 'unbekannt';
      }
      if (attempt < maxAttempts) await delay(retryDelayMs * attempt);
    }
    throw new ApiError(0, method, path, lastError);
  }

  /** 404 ist fuer den Lock ein normaler Zustand, kein Fehler. */
  const optional = (promise, statuses = [404]) => promise.catch((error) => {
    if (error instanceof ApiError && statuses.includes(error.status)) return null;
    throw error;
  });

  return {
    getRef: (ref) => optional(call('GET', pathOf('git', 'ref', ref))),
    createRef: (ref, sha) => call('POST', pathOf('git', 'refs'), {
      ref: ref.startsWith('refs/') ? ref : `refs/${ref}`,
      sha,
    }),
    deleteRef: (ref) => optional(call('DELETE', pathOf('git', 'refs', ref)), [404, 422]),
    getCommit: (sha) => call('GET', pathOf('git', 'commits', sha)),
    createCommit: ({ message, tree, parents, date, name, email }) => call('POST', pathOf('git', 'commits'), {
      message,
      tree,
      parents,
      author: { name, email, date },
      committer: { name, email, date },
    }),
    getIssue: (number) => call('GET', pathOf('issues', number)),
    patchIssue: (number, body) => call('PATCH', pathOf('issues', number), { body }),
  };
}
