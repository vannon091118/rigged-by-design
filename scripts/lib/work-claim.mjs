/**
 * Arbeits-Claim am Issue: getrennt von der Identitaet.
 *
 * Die Identitaet sagt, *wer* arbeitet; der Arbeits-Claim sagt, *woran*. `DONE`
 * ist keine Merge-Erlaubnis und schliesst nichts: es fuehrt nach
 * `REVIEW_PENDING` und sperrt neue Arbeit im selben Worker-Worktree, bis der
 * Maintainer entscheidet. Schliessen darf nur der Maintainer oder der User.
 *
 * Seit #693 ist der Kommentar kein Textprotokoll mehr, das sich selbst
 * autorisiert: der GitHub-Autor wird ueber `.lane-claims/actors.json` einer
 * Rolle zugeordnet, jede Ereignisart hat eine erlaubte Rollenmenge, jedes
 * zustandsaendernde Worker-Ereignis ist an die aktive Claim-ID gebunden, und
 * `ALLOWED` wird bei jedem Uebergang geprueft. Unbekannte Autoren, fremde
 * Claim-IDs, Replays und unerlaubte Reihenfolgen aendern nichts; sie stehen
 * als Befund in `rejected`.
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
  'PARTIAL',
  'REJECT',
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

/** Ereignis -> Zielzustand; `null` heisst: kein Zustandswechsel. */
const TARGET_STATE = Object.freeze({
  WORK_CLAIM: 'ACTIVE',
  PROGRESS: null,
  QUESTION: null,
  ANSWER: null,
  BLOCKED: 'BLOCKED',
  UNRESOLVED: 'UNRESOLVED',
  HANDOFF: null,
  DONE: 'DONE',
  REVIEW_PENDING: 'REVIEW_PENDING',
  REWORK: 'REWORK',
  ACCEPT: 'ACCEPTED',
  PARTIAL: 'PARTIAL',
  REJECT: 'REJECT',
  MERGED: 'MERGED',
  CLOSED: 'CLOSED',
});

/** Verdikte und Schliessen sind Maintainer-/User-Recht, nie Worker-Recht. */
const CONTROL_KINDS = Object.freeze(['ACCEPT', 'PARTIAL', 'REJECT', 'MERGED', 'CLOSED']);

/** Rein informative Ereignisse ohne Zustandswechsel. */
const OBSERVER_KINDS = Object.freeze(['PROGRESS', 'QUESTION', 'ANSWER']);

const CONTROL_ROLES = Object.freeze(['MAINTAINER', 'USER']);
const WORK_ROLES = Object.freeze(['WORKER', 'MAINTAINER']);
const OBSERVE_ROLES = Object.freeze(['WORKER', 'MAINTAINER', 'USER']);

function actorList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry ?? '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Normalisiert die Actor-Policy. Fehlt eine Liste, ist sie leer und damit
 * fail-closed: kein Login ist dann fuer diese Rolle zustaendig.
 */
export function normalizeActors(actors = {}) {
  return Object.freeze({
    maintainers: actorList(actors?.maintainers),
    users: actorList(actors?.users),
    workers: actorList(actors?.workers),
  });
}

/** Verifizierter Kommentar-Autor zu Rolle; Text im Body zaehlt nie. */
export function roleForAuthor(author, actors = {}) {
  const policy = normalizeActors(actors);
  const login = String(author ?? '').trim().toLowerCase();
  if (!login) return 'UNKNOWN';
  if (policy.maintainers.includes(login)) return 'MAINTAINER';
  if (policy.users.includes(login)) return 'USER';
  if (policy.workers.includes(login)) return 'WORKER';
  return 'UNKNOWN';
}

/**
 * Befunde zur Policy selbst. Ein gemeinsamer Principal fuer Worker und
 * Maintainer ist keine Rollentrennung; der Befund bleibt sichtbar, statt die
 * Trennung zu behaupten.
 */
export function describeActorPolicy(actors = {}) {
  const policy = normalizeActors(actors);
  const findings = [];
  const shared = policy.workers.filter(
    (login) => policy.maintainers.includes(login) || policy.users.includes(login),
  );
  if (shared.length > 0) findings.push(`shared-principal:${shared.join(',')}`);
  if (policy.maintainers.length === 0) findings.push('no-maintainer-actor');
  if (policy.workers.length === 0) findings.push('no-worker-actor');
  return findings;
}

export function isWorkState(value) {
  return WORK_STATES.includes(String(value ?? ''));
}

/** Liest Arbeitsereignisse mit Kommentar-ID, Autor und Claim-ID. */
export function parseWorkEvents(comments = []) {
  const events = [];
  const ordered = [...comments].sort((left, right) => Number(left.id) - Number(right.id));
  for (const comment of ordered) {
    const author = String(comment?.author?.login ?? '');
    for (const raw of String(comment?.body ?? '').split(/\r?\n/)) {
      const match = EVENT.exec(raw.trim());
      if (!match) continue;
      events.push({
        kind: match[1],
        commentId: String(comment.id),
        author,
        identity: /identity=(\S+)/.exec(match[2])?.[1] ?? null,
        claimId: /claim_id=(\S+)/.exec(match[2])?.[1] ?? null,
        sha: /sha=([0-9a-f]{7,40})/i.exec(match[2])?.[1] ?? null,
        text: match[2].trim(),
      });
    }
  }
  return events;
}

function rolesFor(kind) {
  if (CONTROL_KINDS.includes(kind)) return CONTROL_ROLES;
  if (OBSERVER_KINDS.includes(kind)) return OBSERVE_ROLES;
  return WORK_ROLES;
}

function rejectionOf(event, role, reason) {
  return {
    kind: event.kind,
    commentId: event.commentId,
    author: event.author || null,
    claimId: event.claimId || null,
    role,
    reason,
  };
}

/**
 * Zustand nach autorisierten Ereignissen (#693).
 *
 * Regeln: Autorisierung zuerst (Rolle), dann Bindung (aktive Claim-ID), dann
 * die Uebergangstabelle. Alles, was scheitert, aendert nichts und steht in
 * `rejected`; Wiederholungen derselben Zeile im selben Kommentar zaehlen
 * genau einmal.
 */
export function evaluateWorkState(comments = [], { actors = {}, claimId = null } = {}) {
  const policy = normalizeActors(actors);
  const events = parseWorkEvents(comments);
  let state = 'OPEN';
  let activeClaim = claimId || null;
  const applied = [];
  const rejected = [];
  const seen = new Set();
  for (const event of events) {
    const replayKey = `${event.commentId}:${event.kind}:${event.text}`;
    if (seen.has(replayKey)) {
      rejected.push(rejectionOf(event, roleForAuthor(event.author, policy), 'duplicate-event'));
      continue;
    }
    seen.add(replayKey);
    const role = roleForAuthor(event.author, policy);
    if (!rolesFor(event.kind).includes(role)) {
      rejected.push(rejectionOf(event, role, role === 'UNKNOWN' ? 'unknown-author' : 'unauthorized-author'));
      continue;
    }
    if (!CONTROL_KINDS.includes(event.kind)) {
      if (!event.claimId) {
        rejected.push(rejectionOf(event, role, 'missing-claim-id'));
        continue;
      }
      if (activeClaim && event.claimId !== activeClaim) {
        rejected.push(rejectionOf(event, role, 'claim-mismatch'));
        continue;
      }
    }
    const target = TARGET_STATE[event.kind];
    if (target) {
      if (!nextStates(state).includes(target)) {
        rejected.push(rejectionOf(event, role, 'transition-not-allowed'));
        continue;
      }
      state = target;
    }
    if (event.kind === 'WORK_CLAIM') activeClaim = event.claimId;
    applied.push({ kind: event.kind, commentId: event.commentId, role, author: event.author, claimId: event.claimId });
  }
  return { state, claimId: activeClaim, applied, rejected };
}

/** Zustand nach autorisierten Ereignissen; Kurzform von `evaluateWorkState`. */
export function workState(comments = [], options = {}) {
  return evaluateWorkState(comments, options).state;
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
