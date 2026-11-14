/**
 * Issue-Claims: GitHub ist die Wahrheit fuer Claims und Lanes.
 *
 * Der Claim einer Lane ist der `CLAIM`-Kommentar am Issue; `.lane-claims/`
 * spiegelt ihn nur mechanisch fuer Hooks und Gates. Dieses Modul liest den
 * Kommentarverlauf eines Issues, wendet die Ereignisse in Reihenfolge an
 * (`CLAIM` -> `HANDOFF` -> `RELEASE`) und sagt, ob das Issue frei ist, ob der
 * eigene Agent es haelt oder ein anderer Agent darauf arbeitet.
 *
 * Es entscheidet nichts ueber Code: `pretask` nutzt die Bewertung als Startgate
 * gegen Parallelarbeit, damit nur ein Agent pro Issue liest und schreibt.
 */
import { execFileSync } from 'node:child_process';

/** Ein Claim-Kommentar; Scope und Plan bleiben als Rohtext erhalten. */
const CLAIM_LINE = /^CLAIM\s+\[([^\]]+)\]\s+(\S+)\s*(.*)$/i;
const RELEASE_LINE = /^RELEASE\s+\[([^\]]+)\]\s+(done|abandoned)\b\s*(.*)$/i;
const HANDOFF_LINE = /^HANDOFF\s+\[([^\]]+)\]\s*(?:->|→|an|to)\s+(\S+)\s*(.*)$/i;
const STAMP = /\b(\d{4}-\d{2}-\d{2}T[0-9:.]+Z)\b/;

/** Antiquote und Listenzeichen entfernen; Kommentare werden tolerant gelesen. */
function lines(body) {
  return String(body ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*+]\s+/, '').replace(/`/g, '').trim())
    .filter(Boolean);
}

/** Key=Value-Felder aus dem Rest einer Claim-Zeile (`scope=… plan=…`). */
function fields(rest) {
  const result = { scope: '', plan: '' };
  const scope = /\bscope=([^\s]+(?:\s+(?!plan=)\S+)*)/i.exec(rest ?? '');
  const plan = /\bplan=(.+)$/i.exec(rest ?? '');
  if (scope) result.scope = scope[1].trim();
  if (plan) result.plan = plan[1].trim();
  return result;
}

/** Agent-Identitaeten; mehrere Aliase duerfen kommagetrennt genannt werden. */
export function agentsOf(agent) {
  return String(agent ?? '')
    .split(',')
    .map((entry) => entry.replace(/\s*\(.*?\)\s*/g, (match) => match).trim().toLowerCase())
    .filter(Boolean);
}

/** Exakter Namensvergleich, Gross-/Kleinschreibung egal. Keine Rateloesung. */
function sameAgent(holder, agents) {
  const name = String(holder ?? '').trim().toLowerCase();
  return Boolean(name) && agents.includes(name);
}

/**
 * Alle Claim-Ereignisse eines Issue-Verlaufs, chronologisch.
 * @param {{ body?: string, createdAt?: string, author?: { login?: string } }[]} comments
 */
export function parseClaimEvents(comments = []) {
  const events = [];
  for (const comment of comments) {
    const at = String(comment?.createdAt ?? '');
    const author = String(comment?.author?.login ?? '');
    for (const line of lines(comment?.body)) {
      const claim = CLAIM_LINE.exec(line);
      if (claim) {
        const stamp = STAMP.exec(line);
        const parsed = fields(claim[3]);
        events.push({
          kind: 'claim',
          claimId: claim[1].trim(),
          agent: claim[2].trim(),
          at: stamp?.[1] ?? at,
          commentAt: at,
          author,
          scope: parsed.scope,
          plan: parsed.plan,
          text: line,
        });
        continue;
      }
      const release = RELEASE_LINE.exec(line);
      if (release) {
        events.push({
          kind: 'release',
          claimId: release[1].trim(),
          result: release[2].toLowerCase(),
          sha: release[3]?.trim() ?? '',
          at,
          commentAt: at,
          author,
          text: line,
        });
        continue;
      }
      const handoff = HANDOFF_LINE.exec(line);
      if (handoff) {
        events.push({
          kind: 'handoff',
          claimId: handoff[1].trim(),
          agent: handoff[2].trim(),
          at,
          commentAt: at,
          author,
          text: line,
        });
      }
    }
  }
  // Stabil nach Zeit; gleiche Zeit behaelt die Verlaufsreihenfolge.
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const byTime = String(left.event.commentAt).localeCompare(String(right.event.commentAt));
      return byTime !== 0 ? byTime : left.index - right.index;
    })
    .map((entry) => entry.event);
}

/**
 * Bewertet den Verlauf: frei, eigener Claim, fremder Claim, veraltet oder
 * unlesbar. `CLAIM` oeffnet, `RELEASE` derselben Claim-ID schliesst, `HANDOFF`
 * derselben Claim-ID wechselt den Halter.
 */
export function evaluateIssueClaim({ comments = [], agent = '', now = Date.now(), staleHours = 72 } = {}) {
  const agents = agentsOf(agent);
  const events = parseClaimEvents(comments);
  let active = null;
  for (const event of events) {
    if (event.kind === 'claim') {
      active = event;
    } else if (event.kind === 'release') {
      if (active && active.claimId === event.claimId) active = null;
    } else if (event.kind === 'handoff') {
      if (active && active.claimId === event.claimId) active = { ...active, agent: event.agent, handoffAt: event.at };
    }
  }
  if (!active) {
    return { status: 'free', holder: null, claimId: null, since: null, ageHours: null, events: events.length, agents };
  }
  const since = active.at || null;
  const ageHours = since && Number.isFinite(Date.parse(since))
    ? Math.max(0, (now - Date.parse(since)) / 3_600_000)
    : null;
  const mine = sameAgent(active.agent, agents);
  const stale = !mine && ageHours !== null && ageHours >= staleHours;
  return {
    status: mine ? 'claimed-self' : stale ? 'stale' : 'claimed-other',
    holder: active.agent,
    claimId: active.claimId,
    since,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(1)),
    scope: active.scope,
    plan: active.plan,
    events: events.length,
  };
}

/**
 * Issue-Nummer einer Lane: aus dem Claim-Feld `issue`, sonst aus Branch oder
 * Claim-ID (`…issue-524…`). Ohne Nummer gibt es keinen Issue-Claim zu pruefen.
 */
export function issueNumberFor(claim) {
  const explicit = Number(claim?.issue);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const match = /(?:issue[-_/]|#)(\d+)/i.exec(`${claim?.branch ?? ''} ${claim?.id ?? ''}`);
  return match ? Number(match[1]) : null;
}

/** Ein `gh`-Aufruf mit einem kontrollierten Wiederholungsversuch. */
function ghJson(args, { cwd, attempts = 2 } = {}) {
  const bin = process.env.RBD_GH_BIN || 'gh';
  const full = process.env.RBD_GH_SCRIPT ? [process.env.RBD_GH_SCRIPT, ...args] : args;
  let lastError = 'unbekannt';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const output = execFileSync(bin, full, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return { ok: true, data: JSON.parse(output) };
    } catch (error) {
      lastError = error instanceof Error ? error.message.split('\n')[0] : 'unbekannt';
    }
  }
  return { ok: false, error: lastError };
}

/** Prioritaets- und Zustandsrang fuer die Board-Reihenfolge. */
const PRIORITY_RANK = Object.freeze({ 'prio-p0': 0, 'prio-p1': 1, 'prio-p2': 2, 'prio-p3': 3 });
const STATE_RANK = Object.freeze({ 'zustand-regression': 0, 'zustand-block': 1, 'zustand-open': 2 });

function labelNames(labels = []) {
  return labels
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
}

/** `P0 -> P1 -> P2/P3`, Regression vor Block vor offen, dann das aeltere Issue. */
export function boardRank(issue = {}) {
  const names = labelNames(issue.labels);
  const priority = names.find((name) => /^prio-p[0-3]$/.test(name));
  const state = names.find((name) => /^zustand-/.test(name)) ?? '';
  return {
    priority: priority ? priority.replace('prio-', '').toUpperCase() : 'P4',
    state,
    rank: [priority ? PRIORITY_RANK[priority] : 4, STATE_RANK[state] ?? 3],
  };
}

/** Offene Issues in Arbeitsreihenfolge; das Board ist die Autoritaet dafuer. */
export function orderBoard(issues = []) {
  return issues
    .map((issue) => ({ ...issue, ...boardRank(issue) }))
    .sort((left, right) =>
      left.rank[0] - right.rank[0] ||
      left.rank[1] - right.rank[1] ||
      String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')) ||
      Number(left.number ?? 0) - Number(right.number ?? 0));
}

/** Die naechsten freien Kandidaten aus dem Board; ein Lesefehler bleibt sichtbar. */
export function readBoard({ limit = 6, cwd } = {}) {
  const result = ghJson(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,labels,createdAt'], { cwd });
  if (!result.ok) return { checked: false, error: result.error, items: [] };
  const items = orderBoard(Array.isArray(result.data) ? result.data : [])
    .slice(0, limit)
    .map((issue) => ({ number: issue.number, title: issue.title, priority: issue.priority, state: issue.state }));
  return { checked: true, total: Array.isArray(result.data) ? result.data.length : 0, items };
}

function ghIssue(number, { cwd } = {}) {
  const result = ghJson(['issue', 'view', String(number), '--json', 'number,state,labels,comments'], { cwd });
  return result.ok ? { ok: true, issue: result.data } : result;
}

/**
 * Liest den Issue-Verlauf und bewertet ihn. Ein nicht abfragbares Issue ist
 * `unknown`, nicht `free`: ohne Beleg wird kein Claim erfunden.
 */
export function readIssueClaim({ number, agent, cwd, now = Date.now(), staleHours = 72 } = {}) {
  if (!number) return { checked: false, status: 'not-linked', number: null };
  const result = ghIssue(number, { cwd });
  if (!result.ok) return { checked: false, status: 'unknown', number, error: result.error };
  const evaluation = evaluateIssueClaim({ comments: result.issue?.comments ?? [], agent, now, staleHours });
  return {
    checked: true,
    number,
    state: result.issue?.state ?? '',
    labels: (result.issue?.labels ?? []).map((label) => label?.name).filter(Boolean),
    // Der Arbeits-Claim braucht den Verlauf, nicht nur das Verdikt (#605).
    comments: result.issue?.comments ?? [],
    ...evaluation,
  };
}

/** Ein Satz fuer Blocker, Warnungen und den naechsten Schritt. */
export function describeIssueClaim(claim) {
  if (!claim) return 'kein Issue-Claim geprueft';
  switch (claim.status) {
    case 'free':
      return `Issue #${claim.number} ist frei: CLAIM-Kommentar fehlt`;
    case 'claimed-self':
      return `Issue #${claim.number} von ${claim.holder} geclaimt (${claim.claimId})`;
    case 'claimed-other':
      return `Issue #${claim.number} ist durch ${claim.holder} geclaimt (${claim.claimId}, seit ${claim.since})`;
    case 'stale':
      return `Issue #${claim.number}: Claim von ${claim.holder} ist ${claim.ageHours}h alt; nicht uebernehmen`;
    case 'unknown':
      return `Issue #${claim.number}: Claim-Lage unbekannt (${claim.error})`;
    case 'not-linked':
      return 'Lane ohne Issue-Nummer: kein Issue-Claim pruefbar';
    default:
      return `Issue-Claim: ${claim.status}`;
  }
}
