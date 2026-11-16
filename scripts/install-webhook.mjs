#!/usr/bin/env node
/**
 * webhook:install — den Repo-Webhook idempotent anlegen (#943).
 *
 * GitHub-Webhooks brauchen eine **erreichbare Empfaenger-URL**. Dieses Repo
 * betreibt keinen Server; deshalb legt das Skript nichts an, solange keine URL
 * uebergeben wird (`--check` belegt dann nur den Ist-Stand).
 *
 * Idempotenz: gesucht wird nach `config.url`. Existiert der Hook, wird er per
 * PATCH aktualisiert, nicht dupliziert. Das Secret kommt aus einer Datei und
 * wird nie ausgegeben.
 *
 * Aufruf:
 *   node scripts/install-webhook.mjs --check
 *   node scripts/install-webhook.mjs --url https://example.test/rbd-hook --secret-file .secrets/hook.txt
 *   node scripts/install-webhook.mjs --remove
 *
 * Ohne Empfaenger ist der richtige Weg `repository_dispatch`:
 *   POST /repos/<owner>/<repo>/dispatches  {"event_type":"board-refresh"}
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const REPO = value('repo', process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design');
const URL_FLAG = value('url');
const SECRET_FILE = value('secret-file');
const CHECK = flag('check');
const REMOVE = flag('remove');
const JSON_OUT = flag('json');
const DEFAULT_EVENTS = ['issues', 'issue_comment', 'pull_request'];

function gh(args, { input } = {}) {
  const bin = process.env.RBD_GH_BIN || 'gh';
  const full = process.env.RBD_GH_SCRIPT ? [process.env.RBD_GH_SCRIPT, ...args] : args;
  try {
    const output = execFileSync(bin, full, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], input, maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, data: output.trim() ? JSON.parse(output) : null };
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).split('\n')[0] : '';
    return { ok: false, error: stderr || (error instanceof Error ? error.message.split('\n')[0] : 'unbekannt') };
  }
}

function readSecret() {
  if (!SECRET_FILE) return null;
  if (!existsSync(SECRET_FILE)) {
    console.error(`WEBHOOK: Secret-Datei fehlt: ${SECRET_FILE}`);
    process.exit(2);
  }
  const secret = readFileSync(SECRET_FILE, 'utf8').replace(/\r?\n$/, '');
  if (secret.length < 16) {
    console.error('WEBHOOK: Secret ist kuerzer als 16 Zeichen');
    process.exit(2);
  }
  return secret;
}

const hooks = gh(['api', `repos/${REPO}/hooks?per_page=100`]);
if (!hooks.ok) {
  // 404/403 heisst: kein Adminrecht. Fail-closed, kein halber Hook.
  console.error(`WEBHOOK: Hooks nicht lesbar (${hooks.error}); Adminrecht auf ${REPO} noetig`);
  process.exit(2);
}
const existing = Array.isArray(hooks.data) ? hooks.data : [];

if (CHECK && !URL_FLAG && !REMOVE) {
  const report = {
    repo: REPO,
    hooks: existing.map((hook) => ({
      id: hook.id,
      url: hook?.config?.url ?? null,
      events: hook.events ?? [],
      active: hook.active,
    })),
    verdict: existing.length === 0
      ? 'kein_webhook_registriert (richtig: ohne Empfaenger bleibt repository_dispatch der Weg)'
      : 'webhook_vorhanden',
  };
  console.log(JSON_OUT ? JSON.stringify(report, null, 2) : JSON.stringify(report, null, 2));
  process.exit(0);
}

if (REMOVE) {
  const url = URL_FLAG ?? existing[0]?.config?.url;
  const target = existing.find((hook) => hook?.config?.url === url) ?? existing[0];
  if (!target) {
    console.log(JSON.stringify({ removed: null, reason: 'kein Hook vorhanden' }, null, 2));
    process.exit(0);
  }
  const result = gh(['api', '-X', 'DELETE', `repos/${REPO}/hooks/${target.id}`]);
  if (!result.ok) {
    console.error(`WEBHOOK: Loeschen fehlgeschlagen (${result.error})`);
    process.exit(2);
  }
  console.log(JSON.stringify({ removed: { id: target.id, url: target?.config?.url ?? null } }, null, 2));
  process.exit(0);
}

if (!URL_FLAG) {
  console.error('WEBHOOK: --url fehlt. Ohne Empfaenger-URL wird kein Hook angelegt (siehe --check).');
  process.exit(2);
}
let parsed;
try {
  parsed = new URL(URL_FLAG);
} catch {
  console.error(`WEBHOOK: '${URL_FLAG}' ist keine gueltige URL`);
  process.exit(2);
}
const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) {
  console.error('WEBHOOK: nur https (oder http auf Loopback) ist zulaessig');
  process.exit(2);
}

const secret = readSecret();
const body = JSON.stringify({
  name: 'web',
  active: true,
  events: DEFAULT_EVENTS,
  config: {
    url: URL_FLAG,
    content_type: 'json',
    insecure_ssl: '0',
    ...(secret ? { secret } : {}),
  },
});

const match = existing.find((hook) => hook?.config?.url === URL_FLAG);
const args = match
  ? ['api', '-X', 'PATCH', `repos/${REPO}/hooks/${match.id}`, '--input', '-']
  : ['api', '-X', 'POST', `repos/${REPO}/hooks`, '--input', '-'];
const result = gh(args, { input: body });
if (!result.ok) {
  // Das Secret steht bewusst nie in der Fehlermeldung.
  console.error(`WEBHOOK: ${match ? 'Aktualisieren' : 'Anlegen'} fehlgeschlagen (${result.error})`);
  process.exit(2);
}
console.log(JSON.stringify({
  [match ? 'updated' : 'created']: { id: result.data?.id ?? null, url: URL_FLAG },
  events: DEFAULT_EVENTS,
  secret: secret ? 'gesetzt (aus Datei)' : 'nicht gesetzt',
}, null, 2));
