/**
 * @test-target: scripts/webhook-receiver.mjs
 * @error-code: ERR-4029
 *
 * Der Empfaenger muss eine gueltig signierte Delivery annehmen und eine
 * falsch signierte abweisen — offline gegen ein aufgezeichnetes Payload und
 * online ueber echtes HTTP. Seit dem Queue-Rueckbau nennt er nur noch das
 * eingeordnete Subjekt, keine lokale Reihenfolge.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signPayload } from '../../../../scripts/lib/webhook-signature.mjs';
import { decide } from '../../../../scripts/webhook-receiver.mjs';
import { PLAN_DELIVERY } from './webhook-fixture';

const ROOT = join(__dirname, '..', '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'webhook-receiver.mjs');
const SECRET = 'test-secret-mit-mindestens-16-zeichen';
const DIR = mkdtempSync(join(tmpdir(), 'rbd-hook-fixture-'));
const PAYLOAD = join(DIR, 'issue-comment.json');
writeFileSync(PAYLOAD, JSON.stringify(PLAN_DELIVERY, null, 2));

const receiver = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [SCRIPT, ...args], {
  encoding: 'utf8',
  env: { ...process.env, RBD_WEBHOOK_SECRET: SECRET, ...env },
});

describe('webhook-receiver (Modul)', () => {
  // Der Import muss die Signaturpruefung selbst erreichen, nicht nur den Prozess.
  it('entscheidet ohne Secret fail-closed und nennt kein Subjekt', () => {
    const body = readFileSync(PAYLOAD);
    const result = decide({
      event: 'issue_comment',
      payload: PLAN_DELIVERY,
      signature: signPayload(body, SECRET),
      body,
    });
    if (process.env.RBD_WEBHOOK_SECRET) {
      expect(result.status).toBe(202);
      expect(result.check.ok).toBe(true);
      expect(result.subject).toEqual(expect.objectContaining({ kind: 'issue-comment', number: 913 }));
    } else {
      expect(result.status).toBe(503);
      expect(result.check.ok).toBe(false);
      expect(result.subject).toBeNull();
    }
  });
});

describe('webhook-receiver (offline)', () => {
  it('nimmt eine korrekt signierte Delivery an und ordnet das Subjekt ein', () => {
    const body = readFileSync(PAYLOAD);
    const run = receiver(['--payload', PAYLOAD, '--event', 'issue_comment', '--signature', signPayload(body, SECRET)]);
    expect(run.status).toBe(0);
    const out = JSON.parse(run.stdout);
    expect(out.verified).toBe(true);
    expect(out.subject).toEqual({ kind: 'issue-comment', number: 913, action: 'created', commentId: 6905796238 });
    expect(out).not.toHaveProperty('queue');
    expect(out).not.toHaveProperty('plan');
  });

  it('weist eine falsch signierte Delivery ab', () => {
    const body = readFileSync(PAYLOAD);
    const dir = mkdtempSync(join(tmpdir(), 'rbd-hook-'));
    const tampered = join(dir, 'payload.json');
    writeFileSync(tampered, `${body.toString('utf8')} `);
    const run = receiver(['--payload', tampered, '--event', 'issue_comment', '--signature', signPayload(body, SECRET)]);
    expect(run.status).toBe(1);
    const out = JSON.parse(run.stdout);
    expect(out.verified).toBe(false);
    expect(out.signature).toBe('Signatur ungueltig');
    expect(out.subject).toBeNull();
  });

  it('ist ohne Secret fail-closed mit genau einer Zeile', () => {
    const run = spawnSync(process.execPath, [SCRIPT, '--payload', PAYLOAD, '--event', 'issue_comment'], {
      encoding: 'utf8',
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'RBD_WEBHOOK_SECRET')),
    });
    expect(run.status).toBe(1);
    expect(run.stderr.trim()).toBe(
      'webhook:receive: RBD_WEBHOOK_SECRET fehlt — Secret aus der Umgebung setzen, nie ins Repo.',
    );
  });
});

describe('webhook-receiver (HTTP)', () => {
  it('antwortet 202 auf gueltige und 401 auf falsche Signatur', async () => {
    // Port aus der PID: kein Zufall, keine Kollision zwischen parallelen Laeufen.
    const port = 18000 + (process.pid % 1000);
    const child = spawn(process.execPath, [SCRIPT, '--serve', '--port', String(port)], {
      env: { ...process.env, RBD_WEBHOOK_SECRET: SECRET },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      child.stdout.on('data', (chunk: Buffer) => {
        if (String(chunk).includes('listening')) { clearTimeout(timer); resolve(true); }
      });
    });
    try {
      expect(ready).toBe(true);
      const body = readFileSync(PAYLOAD);
      const good = await fetch(`http://127.0.0.1:${port}/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-github-event': 'issue_comment', 'x-hub-signature-256': signPayload(body, SECRET) },
        body,
      });
      expect(good.status).toBe(202);
      const accepted = await good.json() as { ok: boolean; subject: { kind: string } };
      expect(accepted.ok).toBe(true);
      expect(accepted.subject.kind).toBe('issue-comment');

      const bad = await fetch(`http://127.0.0.1:${port}/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-github-event': 'issue_comment', 'x-hub-signature-256': 'sha256=deadbeef' },
        body,
      });
      expect(bad.status).toBe(401);
      expect((await bad.json() as { ok: boolean }).ok).toBe(false);
    } finally {
      child.kill();
    }
  }, 20000);
});
