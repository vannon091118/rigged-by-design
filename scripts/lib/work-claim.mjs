/**
 * Arbeits-Claim am Issue: getrennt von der Identitaet.
 *
 * Die Identitaet sagt, *wer* arbeitet; der Arbeits-Claim sagt, *woran*. `DONE`
 * ist keine Merge-Erlaubnis und schliesst nichts: es fuehrt nach
 * `REVIEW_PENDING` und sperrt neue Arbeit im selben Worker-Worktree, bis der
 * Maintainer entscheidet. Schliessen darf nur der Maintainer oder der User.
 *
 * Der Legacy-Parser behandelte `RELEASE done` und `RELEASE abandoned` als
 * gleichwertige erfolgreiche Freigaben. Hier ist `done` ein Review-Zustand und
 * `abandoned` ein offener, dokumentationspflichtiger Rest.
 */

export const WORK_STATES = Object.freeze([
  'OPEN',
  'ACTIVE',
  'BLOCKED',
  'UNRESOLVED',
  'DONE',
  'REVIEW_PENDING',
  'REWORK',
  'ACCEPTED',
  'MERGED',
  'CLOSED',
]);

const EVENT = /^(WORK_CLAIM|PROGRESS|QUESTION|ANSWER|BLOCKED|UNRESOLVED|HANDOFF|DONE|REVIEW_PENDING|REWORK|ACCEPT|PARTIAL|REJECT|MERGED|CLOSED)\b\s*(.*)$/;

const ALLOWED = Object.freeze({
  OPEN: ['ACTIVE'],
  ACTIVE: ['BLOCKED', 'UNRESOLVED', 'DONE', 'QUESTION', 'HANDOFF'],
  BLOCKED: ['ACTIVE', 'UNRESOLVED', 'HANDOFF'],
  UNRESOLVED: ['ACTIVE', 'HANDOFF'],
  DONE: ['REVIEW_PENDING'],
  REVIEW_PENDING: ['REWORK', 'ACCEPTED', 'PARTIAL', 'REJECT'],
  REWORK: ['ACTIVE', 'DONE'],
  ACCEPTED: ['MERGED'],
  PARTIAL: ['ACTIVE', 'REWORK'],
  REJECT: ['ACTIVE', 'UNRESOLVED'],
  MERGED: ['CLOSED'],
  CLOSED: [],
});

export function isWorkState(value) {
  return WORK_STATES.includes(String(value ?? ''));
}

/** Liest Arbeitsereignisse mit Kommentar-ID; unbekannte Zeilen bleiben Text. */
export function parseWorkEvents(comments = []) {
  const events = [];
  const ordered = [...comments].sort((left, right) => Number(left.id) - Number(right.id));
  for (const comment of ordered) {
    for (const raw of String(comment?.body ?? '').split(/\r?\n/)) {
      const match = EVENT.exec(raw.trim());
      if (!match) continue;
      events.push({
        kind: match[1],
        commentId: String(comment.id),
        identity: /identity=(\S+)/.exec(match[2])?.[1] ?? null,
        claimId: /claim_id=(\S+)/.exec(match[2])?.[1] ?? null,
        sha: /sha=([0-9a-f]{7,40})/i.exec(match[2])?.[1] ?? null,
        text: match[2].trim(),
      });
    }
  }
  return events;
}

/** Zustand nach Ereignissen; `DONE` ohne Review bleibt `DONE`. */
export function workState(comments = []) {
  let state = 'OPEN';
  for (const event of parseWorkEvents(comments)) {
    if (event.kind === 'WORK_CLAIM') state = 'ACTIVE';
    else if (event.kind === 'DONE') state = 'DONE';
    else if (event.kind === 'CLOSED') state = 'CLOSED';
    else if (event.kind === 'MERGED') state = 'MERGED';
    else if (isWorkState(event.kind)) state = event.kind;
  }
  return state;
}

/** Neue Arbeit ist nur frei, solange kein Review laeuft. */
export function canClaimWork(state, { sameIssue = false } = {}) {
  if (sameIssue) return true;
  return state === 'OPEN' || state === 'REWORK';
}

/** Schliessen ist Maintainer- oder User-Recht; `MERGED` ist Voraussetzung. */
export function canClose({ role, state } = {}) {
  if (role !== 'MAINTAINER' && role !== 'USER') return { ok: false, reason: 'not-authorized' };
  if (state !== 'MERGED') return { ok: false, reason: 'merge-proof-missing' };
  return { ok: true, reason: 'maintainer-close' };
}

/** Nur dokumentierte Uebergaenge; alles andere ist ein Befund. */
export function nextStates(state) {
  return [...(ALLOWED[state] ?? [])];
}

/** `RELEASE done` ist Review, `abandoned` ist ein offener Rest. */
export function legacyReleaseMeaning(line) {
  const match = /^RELEASE\s+\[[^\]]+\]\s+(done|abandoned)\b/i.exec(String(line ?? '').trim());
  if (!match) return null;
  return match[1].toLowerCase() === 'done'
    ? { state: 'REVIEW_PENDING', releasesIdentity: false }
    : { state: 'UNRESOLVED', releasesIdentity: true };
}
