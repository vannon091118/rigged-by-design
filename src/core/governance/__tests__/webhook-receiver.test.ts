/**
 * @test-target: scripts/webhook-receiver.mjs
 * @error-code: ERR-4029
 *
 * Der Empfaenger muss eine gueltig signierte Delivery annehmen und eine
 * falsch signierte abweisen — offline gegen ein aufgezeichnetes Payload und
 * online ueber echtes HTTP.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signPayload } from '../../../../scripts/lib/webhook-signature.mjs';
import { OPEN_PULLS, PLAN_DELIVERY } from './webhook-fixture';

const ROOT = join(__dirname, '..', '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'webhook-receiver.mjs');
const SECRET = 'test-secret-mit-mindestens-16-zeichen';
const DIR = mkdtempSync(join(tmpdir(), 'rbd-hook-fixture-'));
const PAYLOAD = join(DIR, 'issue-comment-plan.json');
const PULLS = join(DIR, 'pulls.json');
const payloadText = JSON.stringify(PLAN_DELIVERY, null, 2);
writeFileSync(PAYLOAD, payloadText);
writeFileSync(PULLS, JSON.stringify(OPEN_PULLS, null, 2));

const receiver = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [SCRIPT, ...args], {
  encoding: 'utf8',
  env: { ...process.env, RBD_WEBHOOK_SECRET: SECRET, ...env },
});

describe('webhook-receiver (offline)', () => {
  it('nimmt eine korrekt signierte Delivery an und nennt eine Aktion', () => {
    const body = readFileSync(PAYLOAD);
    const run = receiver(['--payload', PAYLOAD, '--event', 'issue_comment', '--pulls', PULLS, '--signature', signPayload(body, SECRET)]);
    expect(run.status).toBe(0);
    const out = JSON.parse(run.stdout);
    expect(out.verified).toBe(true);
    expect(out.plan.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(out.plan.hash).toBe(payloadText.match(/hash=([0-9a-f]{12})/)?.[1]);
    expect(out.action.state).toBe('ACK_MISSING');
    expect(out.action.command).toContain('MERGE_SESSION_JOIN');
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
    expect(out.action).toBeNull();
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
    const child = spawn(process.execPath, [SCRIPT, '--serve', '--offline', '--port', String(port), '--pulls', PULLS], {
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
      const accepted = await good.json() as { ok: boolean; action: { state: string } };
      expect(accepted.ok).toBe(true);
      expect(accepted.action.state).toBe('ACK_MISSING');

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
