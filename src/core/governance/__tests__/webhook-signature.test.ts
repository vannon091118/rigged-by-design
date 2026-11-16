/**
 * @test-target: scripts/lib/webhook-signature.mjs
 * @error-code: ERR-4029
 *
 * GitHub signiert den rohen Body mit HMAC-SHA256. Gueltig heisst: genau diese
 * Signatur, sonst nichts. Ein fehlendes Secret ist fail-closed.
 */
import { describe, expect, it } from 'vitest';
import { verifySignature, webhookSecret, signPayload } from '../../../../scripts/lib/webhook-signature.mjs';

const SECRET = 'test-secret-mit-mindestens-16-zeichen';
const BODY = JSON.stringify({ action: 'created', issue: { number: 913 } });

describe('webhook-signature', () => {
  it('akzeptiert die korrekte Signatur', () => {
    const header = signPayload(BODY, SECRET);
    expect(verifySignature({ body: BODY, secret: SECRET, header })).toEqual({ ok: true, algorithm: 'hmac-sha256' });
  });

  it('weist einen veraenderten Body ab', () => {
    const header = signPayload(BODY, SECRET);
    const result = verifySignature({ body: `${BODY} `, secret: SECRET, header });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Signatur ungueltig');
  });

  it('weist ein falsches Secret ab', () => {
    const header = signPayload(BODY, 'ein-anderes-secret-mit-16-zeichen');
    expect(verifySignature({ body: BODY, secret: SECRET, header }).ok).toBe(false);
  });

  it('weist fehlende, fremde und zu kurze Header ab', () => {
    expect(verifySignature({ body: BODY, secret: SECRET, header: '' }).reason).toContain('Signatur fehlt');
    expect(verifySignature({ body: BODY, secret: SECRET, header: 'sha1=abc' }).reason).toContain('Signaturformat');
    expect(verifySignature({ body: BODY, secret: SECRET, header: 'sha256=abcd' }).ok).toBe(false);
  });

  it('ist ohne Secret fail-closed', () => {
    expect(verifySignature({ body: BODY, secret: '', header: signPayload(BODY, SECRET) }).ok).toBe(false);
    expect(webhookSecret({})).toBeNull();
    expect(webhookSecret({ RBD_WEBHOOK_SECRET: 'kurz' })).toBeNull();
    expect(webhookSecret({ RBD_WEBHOOK_SECRET: SECRET })).toBe(SECRET);
  });
});
