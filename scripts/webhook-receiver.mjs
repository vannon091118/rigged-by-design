#!/usr/bin/env node
/**
 * webhook:receive — der Empfaenger im Repo.
 *
 * Warum: ein Webhook ohne Empfaenger ist Doku. Dieser Prozess nimmt eine
 * Delivery an, prueft die HMAC-Signatur und antwortet mit dem eingeordneten
 * Subjekt. Es gibt keine lokale Merge-Queue mehr; die Integrationsautoritaet
 * liegt beim Maintainer und bei GitHub, nicht bei einem Empfaenger.
 *
 * Zwei Betriebsarten:
 *
 *   node scripts/webhook-receiver.mjs --payload <datei> --event issue_comment
 *       Offline-Pruefung einer aufgezeichneten Delivery.
 *
 *   node scripts/webhook-receiver.mjs --serve --port 8788
 *       HTTP-Empfaenger fuer `POST /webhook`. 202 bei gueltiger Signatur,
 *       401 bei falscher, 405 fuer andere Methoden.
 *
 * Secret: ausschliesslich `RBD_WEBHOOK_SECRET` aus der Umgebung. Fehlt es,
 * endet der Lauf mit genau einer Zeile — es gibt keinen zweiten Speicherort.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deliverySubject } from './lib/webhook-action.mjs';
import { SIGNATURE_HEADER, signPayload, verifySignature, webhookSecret } from './lib/webhook-signature.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'webhook-receiver', enabled: !process.argv.includes('--serve') });

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const SECRET = webhookSecret();

/** Fehlt das Secret, gibt es genau einen Satz — keinen Stacktrace. */
function requireSecret() {
  if (SECRET) return true;
  console.error('webhook:receive: RBD_WEBHOOK_SECRET fehlt — Secret aus der Umgebung setzen, nie ins Repo.');
  return false;
}

function decide({ event, payload, signature, body }) {
  const check = verifySignature({ body, secret: SECRET, header: signature });
  if (!check.ok) return { status: check.reason?.startsWith('kein Secret') ? 503 : 401, check, subject: null };
  return { status: 202, check, subject: deliverySubject({ event, payload }) };
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
  });
  const out = {
    verified: result.check.ok,
    signature: result.check.ok ? result.check.algorithm : result.check.reason,
    subject: result.subject,
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
      });
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ok: result.check.ok,
        reason: result.check.ok ? undefined : result.check.reason,
        subject: result.subject,
      }));
    });
  });
  server.on('error', (error) => {
    console.error(`webhook:receive: Port ${port} nicht belegbar (${error?.code ?? 'unbekannt'})`);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(JSON.stringify({ listening: `http://${host}:${port}/webhook` }, null, 2));
  });
  // Kein `process.exit` nach `listen`: der Prozess lebt vom Server, nicht vom Rueckgabewert.
  return 0;
}

// Die Entscheidung ist ohne Prozessstart pruefbar: `decide` ist rein bis auf
// Secret, der Test importiert sie direkt.
export { decide };

// Nur ein direkter Aufruf startet den Empfaenger; ein Import darf keinen Server
// oeffnen und keinen Prozess beenden.
const invokedDirectly = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (flag('serve')) {
    serve();
  } else {
    process.exit(runOnce());
  }
}
