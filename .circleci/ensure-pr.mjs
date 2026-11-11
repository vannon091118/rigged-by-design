#!/usr/bin/env node
/**
 * Ersatz fuer `ensure-pr.yml`: ein Push auf `lane/**` legt den PR an oder
 * ergaenzt fehlende Pflichtsektionen. Laeuft auf CircleCI ohne `gh`, deshalb
 * direkt gegen die GitHub-REST-API.
 *
 * Erwartet GH_TOKEN im Context `rbd-cloud`. Fehlt das Token, bleibt der Push
 * sichtbar und der PR muss von Hand angelegt werden - kein stiller Erfolg.
 */
const token = process.env.GH_TOKEN ?? '';
const owner = process.env.CIRCLE_PROJECT_USERNAME ?? '';
const repoName = process.env.CIRCLE_PROJECT_REPONAME ?? '';
const branch = process.env.CIRCLE_BRANCH ?? '';

if (!token) {
  console.log('ensure-pr: GH_TOKEN fehlt; PR von Hand anlegen.');
  process.exit(0);
}
if (!owner || !repoName || !branch) {
  console.log('ensure-pr: Repository oder Branch unbekannt; Schritt uebersprungen.');
  process.exit(0);
}

const api = `https://api.github.com/repos/${owner}/${repoName}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'rbd-circleci',
  'Content-Type': 'application/json',
};
const SECTIONS = [
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
];

const call = async (path, init = {}) => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const message = (await import('node:child_process'))
  .execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' })
  .trim();
const subject = message.split(/\r?\n/, 1)[0] || `Lane ${branch}`;
const filler = (missing) => missing.map((section) => `${section}\n\n- siehe Commits und Diff`).join('\n\n');

const open = await call(`/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=main`);
if (open.length === 0) {
  const body = message || `${subject}\n\n${filler(SECTIONS)}`;
  const created = await call('/pulls', {
    method: 'POST',
    body: JSON.stringify({ title: subject, head: branch, base: 'main', body }),
  });
  console.log(`ensure-pr: PR angelegt ${created.html_url}`);
  process.exit(0);
}

const pr = open[0];
const missing = SECTIONS.filter((section) => !String(pr.body ?? '').includes(section));
if (missing.length === 0) {
  console.log(`ensure-pr: PR #${pr.number} existiert bereits.`);
  process.exit(0);
}
await call(`/pulls/${pr.number}`, {
  method: 'PATCH',
  body: JSON.stringify({ body: `${String(pr.body ?? '').trim()}\n\n${filler(missing)}`.trim() }),
});
console.log(`ensure-pr: PR #${pr.number} um ${missing.length} Pflichtsektion(en) ergaenzt.`);
