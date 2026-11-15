/**
 * Claim-Hygiene: offene Lane-Claims gegen den Issue-Status pruefen.
 *
 * Der Audit ist bewusst rein: er liest Claims und einen Issue-Status-Snapshot,
 * schreibt nichts und braucht weder `gh` noch Netz. Ein fehlender Status ist
 * `unknown` und wird sichtbar, niemals als offen oder geschlossen geraten.
 * Nur ein belegter geschlossener Issue-Status bei einem offenen Claim ist ein
 * Closeout-Verstoss.
 */

const ISSUE_STATES = new Set(['open', 'closed', 'unknown']);

/** Normalisiert GitHub- und Snapshot-Schreibweisen auf den einen Vertrag. */
export function normalizeIssueState(value) {
  const raw = typeof value === 'object' && value !== null
    ? (value.state ?? value.status ?? value.issueState ?? '')
    : value;
  const state = String(raw ?? '').trim().toLowerCase();
  if (state === 'open' || state === 'opened' || state === 'ok') return 'open';
  if (state === 'closed' || state === 'done' || state === 'completed') return 'closed';
  return 'unknown';
}

function addState(target, number, value) {
  const parsed = Number(number);
  if (!Number.isInteger(parsed) || parsed <= 0) return;
  const state = normalizeIssueState(value);
  if (state === 'unknown') return;
  // Ein expliziter geschlossener Status gewinnt gegen eine offene Liste:
  // ein geschlossenes Issue darf nie als offen weiterleben.
  if (state === 'closed' || !target.has(parsed)) target.set(parsed, state);
}

/**
 * Liest einen Board-State- oder `{issues, closed}`-Snapshot.
 *
 * Unterstuetzte Formen:
 * - `board-state.json`: `issues` ist eine Map offener Issue-Cursor,
 *   `closedIssuesThisRun` nennt geschlossene Issues.
 * - `{issueStates: {"123": "closed"}}` oder `{issues: [{"number": 1,
 *   "state": "open"}]}` fuer einen expliziten Snapshot.
 */
export function normalizeIssueStates(snapshot = {}) {
  const states = new Map();
  const entries = snapshot?.issueStates ?? snapshot?.issues ?? {};

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry && typeof entry === 'object') addState(states, entry.number, entry);
    }
  } else if (entries && typeof entries === 'object') {
    for (const [number, entry] of Object.entries(entries)) {
      // Board-State-Cursor haben kein `state`; ihre Existenz bedeutet "offen".
      if (entry && typeof entry === 'object' && entry.state === undefined && entry.status === 'OK') {
        addState(states, number, 'open');
      } else {
        addState(states, number, entry);
      }
    }
  }

  for (const number of snapshot?.open ?? []) addState(states, number, 'open');
  for (const number of snapshot?.closedIssuesThisRun ?? []) addState(states, number, 'closed');
  for (const number of snapshot?.closed ?? []) addState(states, number, 'closed');
  return states;
}

/** Alle Claims mit Issue-Status; `violation` nur bei belegtem Closed + offen. */
export function auditClaimHygiene({ claims = [], issueStates = new Map() } = {}) {
  const rows = claims.map((claim) => {
    const issue = Number(claim?.issue);
    const hasIssue = Number.isInteger(issue) && issue > 0;
    const issueState = hasIssue ? (issueStates.get(issue) ?? 'unknown') : 'unknown';
    const claimStatus = String(claim?.status ?? 'unknown');
    return {
      id: String(claim?.id ?? ''),
      branch: String(claim?.branch ?? ''),
      owner: String(claim?.owner ?? ''),
      issue: hasIssue ? issue : null,
      claimStatus,
      issueState,
      violation: claimStatus === 'open' && issueState === 'closed',
    };
  });
  const violations = rows.filter((row) => row.violation);
  const unknown = rows.filter((row) => row.issue !== null && row.issueState === 'unknown');
  return {
    rows,
    violations,
    unknown,
    counts: {
      claims: rows.length,
      openClaims: rows.filter((row) => row.claimStatus === 'open').length,
      known: rows.filter((row) => row.issueState !== 'unknown').length,
      closedViolations: violations.length,
      unknown: unknown.length,
    },
  };
}

/** Eine kurze, deterministische Textzeile je Befund. */
export function formatClaimHygiene(result) {
  const lines = [
    `claim-hygiene: ${result.counts.claims} Claims, ${result.counts.openClaims} offen, ${result.counts.closedViolations} Verstoss(e), ${result.counts.unknown} Status unbekannt`,
  ];
  for (const row of result.violations) {
    lines.push(`ROT: ${row.id} (#${row.issue}) ist offen, Issue ist geschlossen`);
  }
  const preview = result.unknown.slice(0, 8);
  for (const row of preview) {
    lines.push(`unbekannt: ${row.id} (#${row.issue}) - Issue-Status nicht im Snapshot`);
  }
  if (result.unknown.length > preview.length) {
    lines.push(`unbekannt: ... ${result.unknown.length - preview.length} weitere (vollständig mit --json)`);
  }
  if (result.violations.length === 0) lines.push('claim-hygiene: PASS (kein offener Claim auf einem belegten geschlossenen Issue)');
  return lines.join('\n');
}

export { ISSUE_STATES };
