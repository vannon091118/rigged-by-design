#!/usr/bin/env node
/**
 * REST-Helper fuer das Board-Gate (wird synchron von `github-rest.mjs` gestartet).
 *
 * Warum ein eigener Prozess: `pretask` und die Hooks sind synchron. Node hat
 * kein synchrones `fetch`; deshalb erledigt dieser kleine Helfer die Anfrage
 * und gibt JSON auf stdout aus. Aufruf:
 *
 *   node github-rest-fetch.mjs <kind> '<json-params>'
 *
 * Token: optional (`GH_READ_TOKEN`, sonst die Credential-Kette). Fuer
 * oeffentliche Daten genuegt der anonyme Zugriff; ein Token erhoeht nur das
 * Rate-Limit. Repo: `RBD_REPO=owner/repo` oder das `origin`-Remote.
 *
 * Fehler sind Zustaende, keine leeren Listen: bei Rate-Limit, Netzfehler oder
 * abgeschnittener Pagination gibt der Helfer `{unknown:true,state,...}` aus.
 * Der Aufrufer darf das nie als "0 Treffer" weiterreichen.
 */
import { execFileSync } from 'node:child_process';
import { resolveGithubToken } from './credentials.mjs';

const [kind = '', raw = '{}'] = process.argv.slice(2);
const params = JSON.parse(raw);
// Dieselbe Aufloesungsstelle wie der Aufrufer; kein zweiter Token-Pfad.
const token = String(process.env.GH_READ_TOKEN ?? '').trim() || resolveGithubToken().token;

/** Zustand statt Ausnahme: der Aufrufer entscheidet, was UNKNOWN bedeutet. */
class RestUnknown extends Error {
  constructor(state, { status = 0, reset = null, detail = '' } = {}) {
    super(detail || state);
    this.state = state;
    this.status = status;
    this.reset = reset;
  }
}

/** `owner/repo` aus Env oder dem origin-Remote. */
function repoSlug() {
  if (params.repo) return params.repo;
  if (process.env.RBD_REPO) return process.env.RBD_REPO;
  let url;
  try {
    url = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim();
  } catch {
    url = '';
  }
  const match = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(url);
  if (!match) {
    // Auch dieser Abbruch bleibt ein Zustand statt eines nackten Exit-Codes.
    process.stdout.write(JSON.stringify({
      unknown: true,
      state: 'UNKNOWN_REPO',
      status: 0,
      reset: null,
      detail: 'Repository nicht bestimmbar (RBD_REPO setzen)',
    }));
    process.exit(3);
  }
  return `${match[1]}/${match[2]}`;
}

const slug = repoSlug();
const base = `https://api.github.com/repos/${slug}`;

function authHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'rbd-board-gate',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Ein GET; Fehler werden zu genau einem Zustand, nie zu einer leeren Liste. */
async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new RestUnknown('UNKNOWN_NETWORK', { detail: String(error?.message ?? error).slice(0, 160) });
  }
  if (!response.ok) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    // Reset als Epochen-Sekunden: kein Uhrzeit-Zugriff im Determinismus-Pfad.
    const resetEpoch = reset ? Number(reset) : null;
    if (response.status === 429 || (response.status === 403 && remaining === '0')) {
      throw new RestUnknown('UNKNOWN_RATE_LIMIT', { status: response.status, reset: resetEpoch });
    }
    if (response.status === 401 || response.status === 403) {
      throw new RestUnknown('UNKNOWN_AUTH', { status: response.status, reset: resetEpoch });
    }
    throw new RestUnknown('UNKNOWN_NETWORK', { status: response.status, reset: resetEpoch, detail: `HTTP ${response.status}` });
  }
  return response;
}

/** Alle Seiten ueber den `Link: rel="next"`-Zeiger; Obergrenze statt Raten. */
async function paged(path, { maxPages = 20 } = {}) {
  const rows = [];
  let next = path.includes('?') ? path : `${path}?per_page=100`;
  for (let page = 0; page < maxPages; page += 1) {
    const response = await api(next);
    const chunk = await response.json();
    if (!Array.isArray(chunk)) return chunk;
    rows.push(...chunk);
    const link = response.headers.get('link') ?? '';
    const match = /<([^>]+)>;\s*rel="next"/.exec(link);
    if (!match) return rows;
    next = match[1].replace(base, '');
  }
  throw new RestUnknown('UNKNOWN_PAGINATION', { detail: `mehr als ${maxPages} Seiten` });
}

const labels = (issue) => (issue.labels ?? []).map((label) => ({ name: typeof label === 'string' ? label : label.name }));
const comment = (entry) => ({
  // `id` ist die einzige monotone Ordnung im Verlauf: daran entscheidet die
  // Merge-Queue, ob ein ACK NACH dem Plan liegt. Ohne die Zahl kollabieren
  // alle Ereignisse auf 0 und jede Bestaetigung wirkt "zu alt".
  id: Number(entry.id ?? 0),
  body: entry.body ?? '',
  createdAt: entry.created_at ?? '',
  author: { login: entry.user?.login ?? '' },
  user: { login: entry.user?.login ?? '' },
});

/** Offene Issues inklusive PR-Datensaetze ausblenden; GitHub liefert beides. */
function issueRow(issue) {
  return {
    number: issue.number,
    title: issue.title ?? '',
    url: issue.html_url ?? '',
    body: issue.body ?? '',
    labels: labels(issue),
    createdAt: issue.created_at ?? '',
  };
}

async function issues(query) {
  const rows = await paged(`/issues?state=${query.state ?? 'open'}${query.label ? `&labels=${encodeURIComponent(query.label)}` : ''}`);
  const mapped = rows.filter((issue) => !issue.pull_request).map(issueRow);
  const limit = Number(query.limit ?? 0);
  return limit > 0 ? mapped.slice(0, limit) : mapped;
}

async function pullForBranch() {
  const branch = String(params.branch ?? '');
  if (!branch) return null;
  const open = await api(`/pulls?state=all&head=${encodeURIComponent(`${slug.split('/')[0]}:${branch}`)}&per_page=5`);
  const pr = Array.isArray(open) ? open[0] : null;
  if (!pr) return null;
  return {
    number: pr.number,
    url: pr.html_url ?? '',
    state: String(pr.merged_at ? 'MERGED' : pr.state ?? '').toUpperCase(),
    isDraft: Boolean(pr.draft),
    headRefOid: pr.head?.sha ?? '',
    baseRefName: pr.base?.ref ?? '',
    mergedAt: pr.merged_at ?? null,
  };
}

/** Offene Pull Requests; der Agenteneinstieg braucht PR-Bezug je Issue. */
async function pullList() {
  const rows = await paged('/pulls?state=open');
  const limited = rows.slice(0, Number(params.limit ?? 50));
  return limited.map((pr) => ({
    number: pr.number,
    title: pr.title ?? '',
    headRefName: pr.head?.ref ?? '',
    headRefOid: pr.head?.sha ?? '',
    baseRefName: pr.base?.ref ?? '',
    isDraft: Boolean(pr.draft),
    body: pr.body ?? '',
    updatedAt: pr.updated_at ?? '',
    labels: labels(pr),
  }));
}

async function prDetail({ withComments = false } = {}) {
  const pr = await pullForBranch();
  if (!pr) return null;
  if (!withComments) return pr;
  const comments = await paged(`/issues/${pr.number}/comments`);
  return { ...pr, comments: comments.map(comment), statusCheckRollup: [] };
}

async function run() {
let payload;
if (kind === 'issue-view') {
  const issue = await api(`/issues/${Number(params.number)}`);
  const comments = await paged(`/issues/${Number(params.number)}/comments`);
  payload = {
    number: issue.number,
    state: String(issue.state ?? '').toUpperCase(),
    labels: labels(issue),
    comments: comments.map(comment),
  };
} else if (kind === 'issue-list') {
  payload = await issues({ label: params.label, state: params.state, limit: params.limit });
} else if (kind === 'pr-list') {
  payload = await pullList();
} else if (kind === 'issue-comment') {
  // Schreibender Zugang fuer die Merge-Queue (#913): derselbe Token-Pfad,
  // dieselbe Fehlerbehandlung - kein zweiter Weg an GitHub vorbei.
  const posted = await api(`/issues/${Number(params.number)}/comments`, {
    method: 'POST',
    body: { body: String(params.body ?? '') },
  });
  payload = { ok: true, id: posted?.id ?? null, url: posted?.html_url ?? '' };
} else if (kind === 'pull-for-branch') {
  payload = await pullForBranch();
} else if (kind === 'ci-for-branch') {
  payload = await prDetail({ withComments: true });
} else {
  throw new RestUnknown('UNKNOWN_QUERY', { detail: `unbekannte Abfrage '${kind}'` });
}
return payload ?? {};
}

try {
  process.stdout.write(JSON.stringify(await run()));
} catch (error) {
  if (error instanceof RestUnknown) {
    process.stdout.write(JSON.stringify({ unknown: true, state: error.state, status: error.status, reset: error.reset, detail: error.message }));
  } else {
    process.stdout.write(JSON.stringify({ unknown: true, state: 'UNKNOWN_NETWORK', status: 0, reset: null, detail: String(error?.message ?? error).slice(0, 160) }));
  }
}
