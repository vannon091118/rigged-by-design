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
function ghIssue(number, { cwd, attempts = 2 } = {}) {
  const bin = process.env.RBD_GH_BIN || 'gh';
  const base = ['issue', 'view', String(number), '--json', 'number,state,labels,comments'];
  const args = process.env.RBD_GH_SCRIPT ? [process.env.RBD_GH_SCRIPT, ...base] : base;
  let lastError = 'unbekannt';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const output = execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return { ok: true, issue: JSON.parse(output) };
    } catch (error) {
      lastError = error instanceof Error ? error.message.split('\n')[0] : 'unbekannt';
    }
  }
  return { ok: false, error: lastError };
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
