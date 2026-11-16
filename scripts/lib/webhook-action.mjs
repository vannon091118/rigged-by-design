/**
 * Eine Delivery, ein Subjekt.
 *
 * Der Empfaenger erfindet keine eigene Logik mehr: die Merge-Queue ist
 * zurueckgebaut, es gibt keine lokale Reihenfolge und keine ACKs. Was bleibt,
 * ist die Einordnung der Delivery fuer Anzeige und Audit.
 */

/** Einordnung der Delivery: Art, Nummer, Aktion, Kopf. */
export function deliverySubject({ event = '', payload = {} } = {}) {
  if (event.startsWith('pull_request')) {
    const pr = payload?.pull_request;
    return {
      kind: 'pull-request',
      number: Number(pr?.number ?? 0) || null,
      action: String(payload?.action ?? ''),
      merged: Boolean(pr?.merged),
      head: String(pr?.head?.sha ?? ''),
    };
  }
  if (event === 'issues') {
    return { kind: 'issue', number: Number(payload?.issue?.number ?? 0) || null, action: String(payload?.action ?? '') };
  }
  if (event === 'issue_comment') {
    return {
      kind: 'issue-comment',
      number: Number(payload?.issue?.number ?? 0) || null,
      action: String(payload?.action ?? ''),
      commentId: Number(payload?.comment?.id ?? 0) || null,
    };
  }
  return { kind: 'other', number: null, action: String(payload?.action ?? '') };
}
