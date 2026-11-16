/**
 * Merge-Queue nach dem P0-Vertrag (#913).
 *
 * Die Queue ist keine Datei und keine lokale Liste: sie wird bei jedem Lauf aus
 * den Ereignis-Kommentaren an #913 und den offenen PRs neu berechnet. Ein Plan
 * traegt Revision, Hash und den `main`-SHA, auf den er sich bezieht; ein ACK
 * gilt nur fuer genau diesen Hash, von einer registrierten Session und nach
 * dem Plan. Alles andere ist HOLD.
 *
 * Die Funktionen hier sind rein: kein Netz, keine Uhr, keine Datei. Der
 * Aufrufer liefert Kommentare, PRs und den aktuellen `main`-SHA.
 */
import { createHash } from 'node:crypto';

export const MERGE_ISSUE = 913;
export const MERGE_STATUS = Object.freeze({
  READY: 'READY',
  HOLD: 'HOLD',
  BLOCKED: 'BLOCKED',
});

const EVENT = /^MERGE_(SESSION_JOIN|SESSION_LEAVE|PLAN|ACK|BLOCKED|STARTED|COMPLETED)\b(.*)$/;
const ENTRY = /^pr=(\d+)\s+head=([0-9a-f]{7,40})(?:\s+base=([0-9a-f]{7,40}))?/;
const digest = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12);

/** `key=value`-Paare einer Ereigniszeile; unbekannte Schluessel bleiben erhalten. */
function fieldsOf(rest) {
  const fields = {};
  for (const token of String(rest).trim().split(/\s+/)) {
    const at = token.indexOf('=');
    if (at > 0) fields[token.slice(0, at)] = token.slice(at + 1);
  }
  return fields;
}

/** Der Plan-Hash: Revision, `main`-SHA und die geordnete PR-Liste in einer Form. */
export function planDigest({ revision, mainSha, entries = [] }) {
  const canonical = [Number(revision), String(mainSha), ...entries.map((entry) => `${Number(entry.number)}:${entry.head}:${entry.base ?? ''}`)].join('|');
  return digest(canonical);
}

/** Ereignisse aus dem Kommentarverlauf, aufsteigend nach Kommentar-ID. */
export function parseMergeEvents(comments = []) {
  const events = [];
  const ordered = [...comments].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
  for (const comment of ordered) {
    const lines = String(comment?.body ?? '').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const match = EVENT.exec(lines[index].trim());
      if (!match) continue;
      const kind = match[1];
      const fields = fieldsOf(match[2]);
      const base = {
        kind,
        commentId: Number(comment.id ?? 0),
        actor: String(comment?.user?.login ?? comment?.author ?? ''),
        session: fields.session ?? '',
        role: fields.role ?? '',
        at: fields.at ?? '',
      };
      if (kind === 'PLAN') {
        const entries = [];
        for (let next = index + 1; next < lines.length; next += 1) {
          const entry = ENTRY.exec(lines[next].trim());
          if (!entry) break;
          entries.push({ number: Number(entry[1]), head: entry[2], base: entry[3] ?? '' });
        }
        const revision = Number(fields.rev ?? 0);
        const mainSha = fields.main ?? '';
        const hash = planDigest({ revision, mainSha, entries });
        events.push({
          ...base,
          revision,
          mainSha,
          entries,
          hash,
          // Ein Kommentar, der einen anderen Hash behauptet als sein Inhalt
          // ergibt, ist manipuliert: der Plan ist damit unbrauchbar.
          tampered: Boolean(fields.hash) && fields.hash !== hash,
        });
        continue;
      }
      events.push({ ...base, plan: fields.plan ?? '', main: fields.main ?? '', pr: fields.pr ?? '', reason: fields.reason ?? '' });
    }
  }
  return events;
}

/** Der juengste Plan; `null` heisst: keine bestaetigte Reihenfolge. */
export function latestPlan(events = []) {
  return events.filter((event) => event.kind === 'PLAN').at(-1) ?? null;
}

/** Aktive Sessions: JOIN registriert, LEAVE entfernt - Timeout entfernt niemanden. */
export function activeSessions(events = []) {
  const sessions = new Map();
  for (const event of events) {
    if (event.kind === 'SESSION_JOIN' && event.session) {
      sessions.set(event.session, { session: event.session, role: event.role, actor: event.actor, commentId: event.commentId });
    }
    if (event.kind === 'SESSION_LEAVE' && event.session) sessions.delete(event.session);
  }
  return [...sessions.values()];
}

/**
 * Gueltige ACKs: registrierte Session, nach dem Plan, exakt dessen Hash.
 * Mehrfach-ACKs derselben Session zaehlen einmal (der juengste).
 */
export function validAcks(events = [], plan = null) {
  if (!plan) return [];
  const active = new Set(activeSessions(events).map((entry) => entry.session));
  const bySession = new Map();
  for (const event of events) {
    if (event.kind !== 'ACK') continue;
    if (event.commentId <= plan.commentId) continue;
    if (event.plan !== plan.hash) continue;
    if (!active.has(event.session)) continue;
    bySession.set(event.session, event);
  }
  return [...bySession.values()];
}

/**
 * Queue je offenem PR: Position aus dem Plan, Zustand aus Hash, `main`-Drift,
 * ACK-Lage und Kopf-SHA. Nur Position 1 mit vollstaendigen ACKs ist READY.
 */
export function buildQueue({ plan = null, pulls = [], events = [], mainSha = '' } = {}) {
  const sessions = activeSessions(events);
  const acks = validAcks(events, plan);
  const allAcked = sessions.length > 0 && acks.length === sessions.length;
  const drift = Boolean(plan) && Boolean(mainSha) && plan.mainSha !== mainSha;
  const rows = pulls.map((pull) => {
    const number = Number(pull.number);
    const head = String(pull.headRefOid ?? pull.head?.sha ?? '');
    const position = plan ? plan.entries.findIndex((entry) => entry.number === number) : -1;
    const where = position >= 0 ? `Position ${position + 1}/${plan.entries.length}` : 'nicht im Plan';
    const reasons = [];
    let status = MERGE_STATUS.HOLD;
    if (!plan) {
      reasons.push(`kein MERGE_PLAN an #${MERGE_ISSUE}: Merge gesperrt (fail-closed)`);
    } else if (plan.tampered) {
      status = MERGE_STATUS.BLOCKED;
      reasons.push('Plan-Hash im Kommentar passt nicht zum Inhalt: neue Revision veroeffentlichen');
    } else if (drift) {
      reasons.push(`main ist ${mainSha.slice(0, 7)}, Plan nennt ${plan.mainSha.slice(0, 7)}: neue Revision`);
    } else if (position < 0) {
      status = MERGE_STATUS.BLOCKED;
      reasons.push(`${where}: erst Plan mit allen offenen PRs`);
    } else if (head && plan.entries[position].head !== head) {
      status = MERGE_STATUS.BLOCKED;
      reasons.push(`Kopf ${head.slice(0, 7)} ist nicht der bestaetigte ${plan.entries[position].head.slice(0, 7)}`);
    } else if (!allAcked) {
      reasons.push(`ACKs fehlen: ${acks.length}/${sessions.length || 0} aktive Sessions`);
    } else if (position > 0) {
      reasons.push(`${where}: erst #${plan.entries[0].number}`);
    } else {
      status = MERGE_STATUS.READY;
      reasons.push(`${where}, Plan ${plan.hash}, ${sessions.length} von ${sessions.length} Sessions bestaetigt`);
    }
    return { number, head, position: position + 1, status, reasons };
  });
  return rows;
}

/** Darf dieser PR jetzt gemergt werden? `ok:false` nennt den Grund. */
export function authorizeMerge({ plan = null, pulls = [], events = [], mainSha = '', prNumber = 0 } = {}) {
  const queue = buildQueue({ plan, pulls, events, mainSha });
  const entry = queue.find((row) => row.number === Number(prNumber));
  if (!entry) {
    return { ok: false, status: MERGE_STATUS.BLOCKED, reason: `[ERR-4029] PR #${prNumber} ist nicht offen oder nicht lesbar: Merge gesperrt`, queue };
  }
  if (entry.status !== MERGE_STATUS.READY) {
    return { ok: false, status: entry.status, reason: `[ERR-4029] ${entry.status}: ${entry.reasons.join('; ')}`, queue };
  }
  return { ok: true, status: entry.status, reason: entry.reasons.join('; '), queue };
}

/** Der naechste freie Befehl, wenn noch kein Plan existiert. */
export function publishCommand() {
  return 'pnpm run merge:queue -- --publish';
}

/** Der naechste freie Befehl fuer eine Session, die den Plan bestaetigt. */
export function ackCommand(session = '<session>', role = 'worker') {
  return `pnpm run merge:queue -- --ack --session ${session} --role ${role}`;
}

/** Plan-Body aus den offenen PRs; Reihenfolge ist PR-Nummer aufsteigend. */
export function planBody({ revision, mainSha, pulls = [], at = '' }) {
  const entries = [...pulls].sort((a, b) => Number(a.number) - Number(b.number)).map((pull) => ({
    number: Number(pull.number),
    head: String(pull.headRefOid ?? pull.head?.sha ?? ''),
    base: '',
  }));
  const hash = planDigest({ revision, mainSha, entries });
  const lines = [
    `MERGE_PLAN rev=${revision} hash=${hash} main=${mainSha}${at ? ` at=${at}` : ''}`,
    ...entries.map((entry) => `pr=${entry.number} head=${entry.head}`),
    '',
    `Queue-Revision ${revision}: ${entries.length} offene PRs, Basis \`${mainSha}\`.`,
    'Bestaetigung je aktiver Session:',
    `\`${ackCommand('<session>', '<worker|maintainer>')}\``,
  ];
  return { hash, entries, body: lines.join('\n') };
}
