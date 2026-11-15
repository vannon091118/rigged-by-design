/**
 * Merge-Queue-Koordinator (#913): eine persistente Reihenfolge, bestaetigt von
 * allen aktiven Sessions, fail-closed.
 *
 * GitHub-Kommentare sind editierbar und damit kein manipulationsresistentes
 * Log. Sie dienen als sichtbarer Ereignis-Eingang; die Integritaet liefert die
 * Hash-Kette plus ein erwarteter Kettenkopf ausserhalb des Kommentarverlaufs.
 * Queue-Revision, Plan-Hash und ACK-Pruefung sind reine Funktionen ueber den
 * Ereignissen: derselbe Verlauf ergibt auf jedem Geraet dieselbe Revision.
 *
 * Es gibt keinen stillen Default auf Zustimmung: fehlt ein ACK, ist eine
 * Session unbekannt, weicht ein Head ab oder bricht die Kette, ist das HOLD.
 */
import { createHash } from 'node:crypto';

const ROLES = new Set(['maintainer', 'worker']);
const EVENT_LINE = /^\s*(MERGE_(?:SESSION_JOIN|SESSION_LEAVE|PLAN|ACK|STARTED|COMPLETED|BLOCKED))\b\s*(.*)$/;
const SHA = /^[0-9a-f]{7,40}$/i;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** `key=value`-Felder; Werte ohne Leerzeichen, damit ein Kommentar parsebar bleibt. */
function fields(rest) {
  const out = {};
  for (const token of String(rest ?? '').trim().split(/\s+/).filter(Boolean)) {
    const at = token.indexOf('=');
    if (at <= 0) continue;
    out[token.slice(0, at)] = token.slice(at + 1);
  }
  return out;
}

/** `prs=912@<head>:<base>,913@<head>:<base>` — Reihenfolge ist die Queue. */
function parsePrs(raw) {
  return String(raw ?? '').split(',').filter(Boolean).map((chunk) => {
    const match = /^#?(\d+)@([0-9a-f]{7,40}):([0-9a-f]{7,40})$/i.exec(chunk.trim());
    if (!match) return null;
    return { number: Number(match[1]), head: match[2].toLowerCase(), base: match[3].toLowerCase() };
  });
}

/** Stabile, sortierte Form des Plans; nur sie geht in den Hash. */
export function canonicalPlan(plan) {
  return JSON.stringify({
    rev: plan.rev,
    main: String(plan.main).toLowerCase(),
    prs: [...plan.prs]
      .sort((a, b) => a.number - b.number)
      .map((pr) => ({ number: pr.number, head: pr.head.toLowerCase(), base: pr.base.toLowerCase() })),
  });
}

export function planHash(plan) {
  return sha256(canonicalPlan(plan));
}

/** Liest ausschliesslich Zeilen der Form `MERGE_* key=value`; Zitate zaehlen nicht. */
export function parseEvents(comments = []) {
  const events = [];
  for (const comment of Array.isArray(comments) ? comments : []) {
    const commentId = Number(comment?.id ?? 0);
    const at = String(comment?.createdAt ?? '');
    const author = String(comment?.author?.login ?? '');
    for (const raw of String(comment?.body ?? '').split(/\r?\n/)) {
      if (/^\s*>/.test(raw)) continue;
      const match = EVENT_LINE.exec(raw);
      if (!match) continue;
      events.push({ kind: match[1], fields: fields(match[2]), at, author, commentId });
    }
  }
  return events.sort((a, b) => a.commentId - b.commentId || a.at.localeCompare(b.at));
}

/** Hash-Kette ueber den akzeptierten Verlauf; `prev` bindet jeden Eintrag an seinen Vorgaenger. */
export function hashChain(events = []) {
  let prev = 'genesis';
  const entries = events.map((event, index) => {
    const payload = sha256(JSON.stringify({
      kind: event.kind, fields: event.fields, at: event.at, author: event.author, commentId: event.commentId,
    }));
    const hash = sha256(`${prev}:${payload}`);
    const entry = { index, kind: event.kind, commentId: event.commentId, prev, hash };
    prev = hash;
    return entry;
  });
  return { entries, head: prev };
}

/** Prueft die Kette; ein erwarteter Kopf muss exakt passen, sonst Drift. */
export function verifyChain(events = [], expectedHead = '') {
  const { entries, head } = hashChain(events);
  const breaks = [];
  entries.forEach((entry, index) => {
    const want = index === 0 ? 'genesis' : entries[index - 1].hash;
    if (entry.prev !== want) breaks.push(index);
  });
  if (expectedHead && expectedHead !== head) breaks.push(-1);
  return { ok: breaks.length === 0, head, breaks };
}

/**
 * Rekonstruiert die Queue aus dem Ereignisverlauf.
 * @returns {{ready: boolean, hold: string[], plan: object|null, participants: object[],
 *            queue: object[], completed: object|null, chain: object, events: object[]}}
 */
export function buildMergeState(comments = [], { expectedChainHead = '' } = {}) {
  const events = parseEvents(comments);
  const chain = verifyChain(events, expectedChainHead);
  const problems = [];
  const sessions = new Map();
  const acks = new Map();
  const ackHashes = new Map();
  let plan = null;
  let completed = null;

  for (const event of events) {
    const f = event.fields;
    if (event.kind === 'MERGE_SESSION_JOIN') {
      const role = String(f.role ?? '').toLowerCase();
      if (!ROLES.has(role)) { problems.push(`JOIN ohne gueltige Rolle (${event.commentId})`); continue; }
      if (!f.session || !f.agent) { problems.push(`JOIN ohne Session/Agent (${event.commentId})`); continue; }
      sessions.set(f.session, { session: f.session, agent: f.agent, role, claim: f.claim ?? '', at: event.at, left: false });
      continue;
    }
    if (event.kind === 'MERGE_SESSION_LEAVE') {
      const session = sessions.get(f.session);
      if (!session) { problems.push(`LEAVE fuer unbekannte Session (${event.commentId})`); continue; }
      session.left = true;
      continue;
    }
    if (event.kind === 'MERGE_PLAN') {
      const rev = Number(f.rev);
      const prs = parsePrs(f.prs);
      if (!Number.isSafeInteger(rev) || rev < 1 || !SHA.test(String(f.main ?? '')) || prs.length === 0 || prs.some((pr) => !pr)) {
        problems.push(`PLAN unvollstaendig (${event.commentId})`);
        continue;
      }
      const next = { rev, main: String(f.main).toLowerCase(), prs, at: event.at, commentId: event.commentId };
      next.hash = planHash(next);
      if (plan && rev <= plan.rev) { problems.push(`PLAN rev ${rev} ist nicht neuer als ${plan.rev}`); continue; }
      plan = next;
      completed = null;
      continue;
    }
    if (event.kind === 'MERGE_ACK') {
      const session = sessions.get(f.session);
      if (!session || session.left) { problems.push(`ACK ohne aktive Session (${event.commentId})`); continue; }
      if (!plan) { problems.push(`ACK vor jedem PLAN (${event.commentId})`); continue; }
      const wants = { rev: Number(f.rev), hash: String(f.hash ?? ''), main: String(f.main ?? '').toLowerCase() };
      // Widerspruch zaehlt auch dann, wenn keiner der beiden Hashes zum
      // aktuellen Plan passt: dieselbe Session darf eine Revision nicht mit
      // zwei verschiedenen Plaenen bestaetigen.
      const key = `${session.session}:${wants.rev}`;
      const previous = ackHashes.get(key);
      if (previous && previous !== wants.hash) {
        problems.push(`widerspruechliche ACKs fuer ${session.session} (rev ${wants.rev})`);
        continue;
      }
      if (wants.rev !== plan.rev || wants.hash !== plan.hash || wants.main !== plan.main) {
        problems.push(`ACK passt nicht zum aktuellen PLAN (${event.commentId})`);
        continue;
      }
      if (event.at && plan.at && event.at < plan.at) { problems.push(`ACK aelter als der PLAN (${event.commentId})`); continue; }
      if (previous === wants.hash) continue;
      ackHashes.set(key, wants.hash);
      acks.set(`${plan.hash}:${session.session}`, {
        session: session.session, role: session.role, agent: session.agent, at: event.at, hash: plan.hash,
      });
      continue;
    }
    if (event.kind === 'MERGE_COMPLETED') {
      if (!plan) { problems.push(`COMPLETED ohne PLAN (${event.commentId})`); continue; }
      completed = { pr: Number(f.pr), merge: String(f.merge ?? '').toLowerCase(), main: String(f.main ?? '').toLowerCase(), at: event.at };
      continue;
    }
  }

  const participants = [...sessions.values()].filter((session) => !session.left);
  const hold = [...problems];
  if (!chain.ok) hold.push(chain.breaks.includes(-1) ? 'Ereignis-Kette weicht vom erwarteten Kopf ab' : 'Ereignis-Kette ist gebrochen');
  if (!plan) hold.push('kein MERGE_PLAN veroeffentlicht');
  if (participants.length === 0) hold.push('keine aktive Session registriert');
  if (plan) {
    for (const participant of participants) {
      if (!acks.has(`${plan.hash}:${participant.session}`)) hold.push(`ACK fehlt: ${participant.session}`);
    }
    if (completed) hold.push('letzter PLAN ist bereits abgeschlossen; neue Revision noetig');
  }

  const uniqueHold = [...new Set(hold)];
  const ready = uniqueHold.length === 0;
  const queue = (plan?.prs ?? []).map((pr, index) => ({
    ...pr,
    position: index + 1,
    status: ready && index === 0 ? 'READY' : ready ? 'WAITING' : 'HOLD',
  }));
  return { ready, hold: uniqueHold, plan, participants, queue, completed, chain, events };
}

/**
 * Prueft einen konkreten Merge gegen den bestaetigten Plan. Nur der erste
 * Eintrag ist freigegeben, und nur auf exakt bestaetigtem Head/Base/main.
 */
export function evaluateMerge(state, { number, head, base, main } = {}) {
  const reasons = [];
  if (!state?.ready) reasons.push(...(state?.hold ?? ['Queue nicht READY']).map((reason) => `HOLD: ${reason}`));
  const first = state?.queue?.[0];
  if (!first) reasons.push('Queue ist leer');
  else if (Number(number) !== first.number) reasons.push(`PR #${number} ist nicht der erste Eintrag (#${first.number})`);
  if (first && String(head ?? '').toLowerCase() !== first.head) reasons.push('PR-Head weicht vom bestaetigten Head ab');
  if (first && String(base ?? '').toLowerCase() !== first.base) reasons.push('PR-Base weicht von der bestaetigten Base ab');
  if (state?.plan && String(main ?? '').toLowerCase() !== state.plan.main) reasons.push('main-SHA weicht vom bestaetigten main ab');
  return { ok: reasons.length === 0, reasons };
}
