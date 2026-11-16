#!/usr/bin/env node
/**
 * webhook:receive — der Empfaenger im Repo.
 *
 * Warum: ein Webhook ohne Empfaenger ist Doku. Dieser Prozess nimmt eine
 * Delivery an, prueft die HMAC-Signatur, bildet sie auf dieselbe Entscheidung
 * ab wie `agent:start` und antwortet mit genau dieser einen naechsten Aktion.
 *
 * Zwei Betriebsarten:
 *
 *   node scripts/webhook-receiver.mjs --payload <datei> --event issue_comment [--live]
 *       Offline-Pruefung einer aufgezeichneten Delivery. Ohne `--live` werden
 *       Verlauf und PRs aus `--thread`/`--pulls` gelesen; mit `--live` ueber
 *       denselben REST-Pfad wie das Board.
 *
 *   node scripts/webhook-receiver.mjs --serve --port 8788
 *       HTTP-Empfaenger fuer `POST /webhook`. 202 bei gueltiger Signatur,
 *       401 bei falscher, 405 fuer andere Methoden.
 *
 * Secret: ausschliesslich `RBD_WEBHOOK_SECRET` aus der Umgebung. Fehlt es,
 * endet der Lauf mit genau einer Zeile — es gibt keinen zweiten Speicherort.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { rest } from './lib/github-rest.mjs';
import { deliverySubject, deliveryPlanned } from './lib/webhook-action.mjs';
import { SIGNATURE_HEADER, signPayload, verifySignature, webhookSecret } from './lib/webhook-signature.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const SECRET = webhookSecret();
const SESSION = value('session', process.env.RBD_AGENT ?? 'agent-local');
const ROLE = value('role', 'worker');

/** Fehlt das Secret, gibt es genau einen Satz — keinen Stacktrace. */
function requireSecret() {
  if (SECRET) return true;
  console.error('webhook:receive: RBD_WEBHOOK_SECRET fehlt — Secret aus der Umgebung setzen, nie ins Repo.');
  return false;
}

/** Live-Zustand ueber denselben REST-Pfad wie `agent:start`. */
function currentMain() {
  try {
    return execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function liveContext() {
  const thread = rest('issue-view', { number: Number(process.env.RBD_MERGE_ISSUE ?? 913) });
  const pulls = rest('pr-list', { state: 'open', limit: 50 });
  return {
    comments: thread.ok ? thread.data?.comments ?? [] : [],
    pulls: pulls.ok && Array.isArray(pulls.data) ? pulls.data : [],
    // Dieselbe Basis wie `agent:start`; sonst fehlt die Drift-Erkennung.
    mainSha: String(process.env.RBD_MAIN_SHA ?? '') || currentMain(),
    error: thread.ok ? '' : String(thread.error ?? ''),
  };
}

/** Verlauf/PRs aus Dateien, damit ein Lauf ohne Netz reproduzierbar bleibt. */
function fileContext() {
  const read = (name) => {
    const path = value(name);
    if (!path) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  const thread = read('thread');
  const pulls = read('pulls');
  return {
    comments: Array.isArray(thread) ? thread : thread?.comments ?? [],
    pulls: Array.isArray(pulls) ? pulls : pulls?.pulls ?? [],
    mainSha: String(read('main')?.sha ?? process.env.RBD_MAIN_SHA ?? ''),
    error: '',
  };
}

function decide({ event, payload, signature, body, context }) {
  const check = verifySignature({ body, secret: SECRET, header: signature });
  if (!check.ok) return { status: check.reason?.startsWith('kein Secret') ? 503 : 401, check, action: null };
  const subject = deliverySubject({ event, payload });
  const context_ = context();
  const planned = deliveryPlanned({
    event, payload, comments: context_.comments, pulls: context_.pulls,
    mainSha: context_.mainSha, session: SESSION, role: ROLE,
  });
  return { status: 202, check, subject, plan: planned.plan, queue: planned.queue, action: planned.action };
}

function runOnce() {
  if (!requireSecret()) return 1;
  const payloadPath = value('payload');
  if (!payloadPath) {
    console.error('webhook:receive: --payload <datei> fehlt');
    return 2;
  }
  const body = readFileSync(payloadPath);
  // Keine Selbstsignatur als Default: eine Pruefung, die ihren eigenen Beweis
  // erzeugt, beweist nichts. `--sign` ist ausdruecklich fuer lokale Laeufe.
  const chosen = value('signature', process.env.RBD_WEBHOOK_SIGNATURE) || (flag('sign') ? signPayload(body, SECRET) : '');
  const result = decide({
    event: value('event', 'issue_comment'),
    payload: JSON.parse(body.toString('utf8')),
    signature: chosen,
    body,
    context: flag('live') ? liveContext : fileContext,
  });
  const out = {
    verified: result.check.ok,
    signature: result.check.ok ? result.check.algorithm : result.check.reason,
    subject: result.subject ?? null,
    plan: result.plan ?? null,
    queue: result.queue ?? [],
    action: result.action ?? null,
  };
  console.log(JSON.stringify(out, null, 2));
  return result.check.ok ? 0 : 1;
}

function serve() {
  if (!requireSecret()) return 1;
  const port = Number(value('port', '8788'));
  const host = value('host', '127.0.0.1');
  const server = createServer((request, response) => {
    const url = String(request.url ?? '');
    if (request.method !== 'POST' || !url.startsWith('/webhook')) {
      response.writeHead(405, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: false, reason: 'nur POST /webhook' }));
      return;
    }
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks);
      let payload;
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: false, reason: 'Body ist kein JSON' }));
        return;
      }
      const result = decide({
        event: String(request.headers['x-github-event'] ?? ''),
        payload,
        signature: request.headers[SIGNATURE_HEADER],
        body,
        context: flag('offline') ? fileContext : liveContext,
      });
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ok: result.check.ok,
        reason: result.check.ok ? undefined : result.check.reason,
        action: result.action ?? null,
        subject: result.subject ?? null,
      }));
    });
  });
  server.on('error', (error) => {
    console.error(`webhook:receive: Port ${port} nicht belegbar (${error?.code ?? 'unbekannt'})`);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(JSON.stringify({ listening: `http://${host}:${port}/webhook`, session: SESSION }, null, 2));
  });
  // Kein `process.exit` nach `listen`: der Prozess lebt vom Server, nicht vom Rueckgabewert.
  return 0;
}

if (flag('serve')) {
  serve();
} else {
  process.exit(runOnce());
}
