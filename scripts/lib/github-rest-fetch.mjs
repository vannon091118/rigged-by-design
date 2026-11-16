#!/usr/bin/env node
/**
 * REST-Helper fuer das Board (wird synchron von `github-rest.mjs` gestartet).
 *
 * Warum ein eigener Prozess: `pretask` und die Hooks sind synchron. Node hat
 * kein synchrones `fetch`; deshalb erledigt dieser kleine Helfer die Anfrage
 * und gibt JSON auf stdout aus. Aufruf:
 *
 *   node github-rest-fetch.mjs <kind> '<json-params>'
 *
 * Auth: anonym ist der Normalfall. Ein Token (`GH_TOKEN`, `GITHUB_TOKEN`, `gh
 * auth token`, Credential-Helper) erhoeht nur das Rate-Limit und ist nie
 * Pflicht. Unauthentifizierte REST-Aufrufe sind auf 60 pro Stunde und IP
 * begrenzt.
 *
 * Listen werden vollstaendig paginiert. Ein Fehler ist nie eine leere Liste:
 * der Helfer endet mit einem eigenen Exit-Code und schreibt den Zustand nach
 * stderr — `github-rest.mjs` uebersetzt ihn in `UNKNOWN_*`.
 *
 *   2 = UNKNOWN_AUTH            (401, oder 403 mit Auth-Hinweis)
 *   3 = Repository nicht bestimmbar
 *   4 = UNKNOWN_RATE_LIMIT      (403/429 oder X-RateLimit-Remaining: 0)
 *   5 = UNKNOWN_NETWORK         (Netz-/DNS-Fehler)
 *   6 = UNKNOWN_RESPONSE        (unerwartete Antwort, kein JSON)
 *   7 = unbekannte Abfrage
 */
import { execFileSync } from 'node:child_process';
import { resolveGithubToken } from './credentials.mjs';

const [kind = '', raw = '{}'] = process.argv.slice(2);
const params = JSON.parse(raw);
// Ein Token ist optional; ohne Token liest der Helfer anonym.
const token = resolveGithubToken().token;

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
    console.error('UNKNOWN_REPO: Repository nicht bestimmbar (RBD_REPO setzen)');
    process.exit(3);
  }
  return `${match[1]}/${match[2]}`;
}

const slug = repoSlug();
const base = `https://api.github.com/repos/${slug}`;

function headers() {
  const result = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'rbd-board-gate',
  };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

/** Ein Fehler wird benannt, nie zu einer leeren Liste. */
function fail(response, path) {
  const status = response.status;
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  if (status === 403 || status === 429 || remaining === '0') {
    console.error(`UNKNOWN_RATE_LIMIT: HTTP ${status} ${path}; reset=${reset ?? 'unbekannt'}`);
    process.exit(4);
  }
  if (status === 401 || status === 403) {
    console.error(`UNKNOWN_AUTH: HTTP ${status} ${path}`);
    process.exit(2);
  }
  console.error(`UNKNOWN_RESPONSE: HTTP ${status} ${path}`);
  process.exit(6);
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    console.error(`UNKNOWN_NETWORK: ${String(error?.message ?? error).split('\n')[0].slice(0, 160)}`);
    process.exit(5);
  }
  if (!response.ok) fail(response, path);
  return response;
}

async function json(path, options) {
  const response = await request(path, options);
  try {
    return await response.json();
  } catch {
    console.error(`UNKNOWN_RESPONSE: kein JSON ${path}`);
    process.exit(6);
  }
}

/** Naechste Seite aus dem Link-Header; `null` heisst: fertig. */
function nextPage(response) {
  const link = response.headers.get('link') ?? '';
  const match = /<([^>]+)>;\s*rel="next"/.exec(link);
  return match ? match[1] : null;
}

/**
 * Vollstaendig paginierte Liste. `per_page=100` allein ist kein
 * Vollstaendigkeitsbeleg; ohne Link-Header endet die Schleife nach Seite 1.
 */
async function paginate(path) {
  const rows = [];
  let url = `${base}${path}`;
  let guard = 0;
  while (url) {
    guard += 1;
    if (guard > 100) {
      console.error(`UNKNOWN_RESPONSE: mehr als 100 Seiten ${path}`);
      process.exit(6);
    }
    let response;
    try {
      response = await fetch(url, { headers: headers() });
    } catch (error) {
      console.error(`UNKNOWN_NETWORK: ${String(error?.message ?? error).split('\n')[0].slice(0, 160)}`);
      process.exit(5);
    }
    if (!response.ok) fail(response, url.replace(base, ''));
    let page;
    try {
      page = await response.json();
    } catch {
      console.error(`UNKNOWN_RESPONSE: kein JSON ${url}`);
      process.exit(6);
    }
    if (!Array.isArray(page)) {
      console.error(`UNKNOWN_RESPONSE: Liste erwartet ${url}`);
      process.exit(6);
    }
    rows.push(...page);
    url = nextPage(response);
  }
  return rows;
}

const labels = (issue) => (issue.labels ?? []).map((label) => ({ name: typeof label === 'string' ? label : label.name }));
const comment = (entry) => ({
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
  const rows = await paginate(`/issues?state=${query.state ?? 'open'}&per_page=100${query.label ? `&labels=${encodeURIComponent(query.label)}` : ''}`);
  return rows.filter((issue) => !issue.pull_request).map(issueRow);
}

async function commentsOf(number) {
  const rows = await paginate(`/issues/${Number(number)}/comments?per_page=100`);
  return rows.map(comment);
}

async function pullForBranch() {
  const branch = String(params.branch ?? '');
  if (!branch) return null;
  const open = await json(`/pulls?state=all&head=${encodeURIComponent(`${slug.split('/')[0]}:${branch}`)}&per_page=5`);
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
  const rows = await paginate('/pulls?state=open&per_page=100');
  return rows.map((pr) => ({
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

async function dispatch() {
  await request('/dispatches', {
    method: 'POST',
    body: { event_type: String(params.event_type ?? 'board-refresh') },
  });
  return { dispatched: true, event_type: String(params.event_type ?? 'board-refresh') };
}

async function prDetail({ withComments = false } = {}) {
  const pr = await pullForBranch();
  if (!pr) return null;
  if (!withComments) return pr;
  return { ...pr, comments: await commentsOf(pr.number), statusCheckRollup: [] };
}

let payload;
if (kind === 'issue-view') {
  const issue = await json(`/issues/${Number(params.number)}`);
  payload = {
    number: issue.number,
    state: String(issue.state ?? '').toUpperCase(),
    labels: labels(issue),
    comments: await commentsOf(issue.number),
  };
} else if (kind === 'issue-list') {
  payload = await issues({ label: params.label, state: params.state });
} else if (kind === 'pr-list') {
  payload = await pullList();
} else if (kind === 'issue-comment') {
  const posted = await json(`/issues/${Number(params.number)}/comments`, {
    method: 'POST',
    body: { body: String(params.body ?? '') },
  });
  payload = { ok: true, id: posted?.id ?? null, url: posted?.html_url ?? '' };
} else if (kind === 'hooks') {
  // Nur lesbare Felder: das Secret legt GitHub nie offen.
  const hooks = await json('/hooks?per_page=100');
  payload = (Array.isArray(hooks) ? hooks : []).map((hook) => ({
    id: hook.id,
    active: Boolean(hook.active),
    events: Array.isArray(hook.events) ? hook.events : [],
    config: { url: hook?.config?.url ?? '' },
    last_response: { status: hook?.last_response?.status ?? null },
  }));
} else if (kind === 'dispatch') {
  payload = await dispatch();
} else if (kind === 'pull-for-branch') {
  payload = await pullForBranch();
} else if (kind === 'ci-for-branch') {
  payload = await prDetail({ withComments: true });
} else {
  console.error(`UNKNOWN_QUERY: unbekannte Abfrage '${kind}'`);
  process.exit(7);
}

process.stdout.write(JSON.stringify(payload ?? {}));
