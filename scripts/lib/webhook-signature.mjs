/**
 * Signaturpruefung fuer GitHub-Deliveries.
 *
 * GitHub signiert den **rohen** Body mit `HMAC-SHA256` und schickt das Ergebnis
 * in `X-Hub-Signature-256: sha256=<hex>`. Geprueft wird zeitkonstant
 * (`timingSafeEqual`), damit ein Angreifer die Signatur nicht Byte fuer Byte
 * erraten kann. Ohne Secret ist jede Delivery ungueltig — fail-closed.
 *
 * Das Secret kommt ausschliesslich aus der Umgebung (`RBD_WEBHOOK_SECRET`) und
 * wird von dieser Datei nie geloggt, nie geschrieben und nie zurueckgegeben.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-hub-signature-256';
export const SIGNATURE_PREFIX = 'sha256=';

/** Erwartete Signatur fuer einen Body; nur fuer Pruefung und Tests. */
export function signPayload(body, secret) {
  const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  return `${SIGNATURE_PREFIX}${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

/**
 * @returns {{ ok: boolean, algorithm?: string, reason?: string }}
 */
export function verifySignature({ body, secret, header } = {}) {
  if (!secret) return { ok: false, reason: 'kein Secret: RBD_WEBHOOK_SECRET fehlt' };
  const value = String(header ?? '').trim();
  if (!value) return { ok: false, reason: `Signatur fehlt (${SIGNATURE_HEADER})` };
  if (!value.startsWith(SIGNATURE_PREFIX)) {
    return { ok: false, reason: `unbekanntes Signaturformat (erwartet ${SIGNATURE_PREFIX}<hex>)` };
  }
  const expected = signPayload(body, secret);
  const given = Buffer.from(value, 'utf8');
  const want = Buffer.from(expected, 'utf8');
  if (given.length !== want.length) return { ok: false, reason: 'Signatur ungueltig' };
  return timingSafeEqual(given, want)
    ? { ok: true, algorithm: 'hmac-sha256' }
    : { ok: false, reason: 'Signatur ungueltig' };
}

/** Das Secret aus der Umgebung — oder `null`, nie ein Fehlertext mit Wert. */
export function webhookSecret(env = process.env) {
  const value = String(env.RBD_WEBHOOK_SECRET ?? '').trim();
  return value.length >= 16 ? value : null;
}
