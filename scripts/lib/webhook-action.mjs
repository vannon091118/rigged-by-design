/**
 * Eine Delivery, eine Entscheidung.
 *
 * Der Empfaenger erfindet keine eigene Logik: er uebersetzt das Ereignis in
 * den Verlauf und die offenen PRs, die auch `agent:start` liest, und ruft
 * dieselbe Funktion `nextAction()` auf. Damit liefern Webhook und CLI fuer
 * denselben Zustand denselben Befehl — nicht zwei Wahrheiten.
 *
 * Der Verlauf kommt aus dem Thread (Kommentare an #913). Eine Delivery kann
 * ihn nur ergaenzen: ist der kommentierte Plan noch nicht im gelesenen Thread,
 * wird das Ereignis vorne angehaengt.
 */
import {
  MERGE_ISSUE,
  buildQueue,
  latestPlan,
  nextAction,
  parseMergeEvents,
} from './merge-queue.mjs';

/** Ereignisse, die den Merge-Verlauf an #913 speisen. */
export const MERGE_EVENT_LINE = /^MERGE_(SESSION_JOIN|SESSION_LEAVE|PLAN|ACK)\b/m;

/** Ist diese Delivery fuer den Merge-Verlauf relevant? */
export function touchesMergeThread({ event = '', payload = {} } = {}) {
  const issue = Number(payload?.issue?.number ?? payload?.issue ?? 0);
  if (event === 'issue_comment' && issue === MERGE_ISSUE) {
    return MERGE_EVENT_LINE.test(String(payload?.comment?.body ?? ''));
  }
  return false;
}

/**
 * Welche Lane beruehrt die Delivery? Nur fuer die Anzeige; entschieden wird
 * ueber die Queue, nicht ueber das Ereignis allein.
 */
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

function commentFrom(payload) {
  const comment = payload?.comment ?? {};
  return {
    id: Number(comment.id ?? 0),
    body: String(comment.body ?? ''),
    user: { login: String(comment.user?.login ?? '') },
    author: { login: String(comment.user?.login ?? '') },
  };
}

/**
 * Verlauf + Queue aus dem Zustand, den auch `agent:start` liest.
 *
 * @param {{ event?: string, payload?: object, comments?: object[], pulls?: object[],
 *           mainSha?: string, session?: string, role?: string }} input
 */
export function deliveryPlanned({
  event = '', payload = {}, comments = [], pulls = [], mainSha = '', session = 'agent-local', role = 'worker',
} = {}) {
  const incoming = touchesMergeThread({ event, payload }) ? [commentFrom(payload)] : [];
  const known = Array.isArray(comments) ? comments : [];
  const ids = new Set(known.map((entry) => Number(entry?.id ?? 0)));
  const thread = [...known, ...incoming.filter((entry) => !ids.has(entry.id))];
  const events = parseMergeEvents(thread);
  const plan = latestPlan(events);
  const queue = buildQueue({ plan, pulls: Array.isArray(pulls) ? pulls : [], events, mainSha });
  const action = nextAction({ plan, queue, events, session, role, mainSha });
  return {
    plan: plan ? { revision: plan.revision, hash: plan.hash, mainSha: plan.mainSha } : null,
    sessions: events.filter((entry) => entry.kind === 'SESSION_JOIN').length,
    queue,
    action,
  };
}
