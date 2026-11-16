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
 * Token: `GH_TOKEN` oder `GITHUB_TOKEN`. Repo: `RBD_REPO=owner/repo` oder das
 * `origin`-Remote. Ausgabe ist auf die Form von `gh --json` normalisiert, damit
 * die Aufrufer keinen zweiten Codepfad brauchen.
 */
import { execFileSync } from 'node:child_process';
import { resolveGithubToken } from './credentials.mjs';

const [kind = '', raw = '{}'] = process.argv.slice(2);
const params = JSON.parse(raw);
// Dieselbe Aufloesungsstelle wie der Aufrufer; kein zweiter Token-Pfad.
const token = resolveGithubToken().token;

if (!token) {
  console.error('REST: keine Credential-Quelle (GH_TOKEN, GITHUB_TOKEN, gh auth token oder git-credential-helper); `gh auth login` ausfuehren');
  process.exit(2);
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
    console.error('REST: Repository nicht bestimmbar (RBD_REPO setzen)');
    process.exit(3);
  }
  return `${match[1]}/${match[2]}`;
}

const slug = repoSlug();
const base = `https://api.github.com/repos/${slug}`;

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'rbd-board-gate',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    console.error(`REST ${method} ${path}: HTTP ${response.status}`);
    process.exit(4);
  }
  return response.json();
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
  const perPage = Math.min(Number(params.limit ?? 100), 100);
  const rows = await api(`/issues?state=${query.state ?? 'open'}&per_page=${perPage}${query.label ? `&labels=${encodeURIComponent(query.label)}` : ''}`);
  return rows.filter((issue) => !issue.pull_request).map(issueRow);
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
  const rows = await api('/pulls?state=open&per_page=' + Math.min(Number(params.limit ?? 50), 100));
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

/** Ereignis-Einstieg: loest den Board-Overview-Workflow ohne Server aus. */
async function dispatch() {
  const response = await fetch(`${base}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'rbd-board-gate',
    },
    body: JSON.stringify({ event_type: String(params.event_type ?? 'board-refresh') }),
  });
  if (!response.ok) {
    console.error(`REST POST /dispatches: HTTP ${response.status}`);
    process.exit(4);
  }
  return { dispatched: true, event_type: String(params.event_type ?? 'board-refresh') };
}

async function prDetail({ withComments = false } = {}) {
  const pr = await pullForBranch();
  if (!pr) return null;
  if (!withComments) return pr;
  const comments = await api(`/issues/${pr.number}/comments?per_page=100`);
  return { ...pr, comments: comments.map(comment), statusCheckRollup: [] };
}

let payload;
if (kind === 'issue-view') {
  const issue = await api(`/issues/${Number(params.number)}`);
  const comments = await api(`/issues/${Number(params.number)}/comments?per_page=100`);
  payload = {
    number: issue.number,
    state: String(issue.state ?? '').toUpperCase(),
    labels: labels(issue),
    comments: comments.map(comment),
  };
} else if (kind === 'issue-list') {
  payload = await issues({ label: params.label, state: params.state });
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
} else if (kind === 'dispatch') {
  payload = await dispatch();
} else if (kind === 'pull-for-branch') {
  payload = await pullForBranch();
} else if (kind === 'ci-for-branch') {
  payload = await prDetail({ withComments: true });
} else {
  console.error(`REST: unbekannte Abfrage '${kind}'`);
  process.exit(5);
}

process.stdout.write(JSON.stringify(payload ?? {}));
