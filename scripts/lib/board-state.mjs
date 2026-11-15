/**
 * Board-State-Snapshot (#834): GitHub ist die Wahrheit, die Datei ist der Beleg.
 *
 * Der Snapshot wird aus dem Live-Board erzeugt, nicht aus dem Gedaechtnis eines
 * Laufs: offene Issues, offene Pull Requests und der main-Kopf kommen aus GitHub
 * und Git. Claims auf geschlossene Issues fallen heraus, weil sie keine Arbeit
 * mehr abbilden. Hier stehen nur reine Funktionen; Netz und Git liegen im
 * Skript `scripts/sync-board-state.mjs`.
 */

/** Ein Eintrag der Issue-Liste ist ein Pull Request, kein Issue. */
export function isPullRequest(entry = {}) {
  return Boolean(entry?.pullRequest ?? entry?.pull_request);
}

function labelNames(labels = []) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
}

/** Ein Board-Read liefert Issues und Pull Requests gemischt. */
export function splitBoard(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    issues: list.filter((entry) => !isPullRequest(entry)),
    pullRequests: list.filter(isPullRequest),
  };
}

/** Claims behalten, deren Issue noch offen ist; der Rest ist ein Befund. */
export function pruneActiveClaims(claims = [], openNumbers = new Set()) {
  const kept = [];
  const dropped = [];
  for (const claim of Array.isArray(claims) ? claims : []) {
    const issue = Number(claim?.issue);
    if (Number.isInteger(issue) && issue > 0 && openNumbers.has(issue)) kept.push(claim);
    else dropped.push(claim);
  }
  return { kept, dropped };
}

/** Offene Pull Requests in der Form, die der Snapshot dokumentiert. */
export function summarizePullRequest(pullRequest = {}) {
  return {
    number: Number(pullRequest.number),
    title: String(pullRequest.title ?? ''),
    branch: pullRequest.headRefName ?? pullRequest.head?.ref ?? pullRequest.branch ?? null,
    draft: Boolean(pullRequest.isDraft ?? pullRequest.draft),
    labels: labelNames(pullRequest.labels),
  };
}

/**
 * Naechster Snapshot. Uebernommene Felder des Vorgaengers (Summary, Blockers,
 * Warnungen) bleiben stehen; nur die Live-Felder werden nachgezogen.
 */
export function nextBoardState({
  previous = {},
  issues = [],
  pullRequests = [],
  head,
  headMessage = null,
  at,
  worktree = null,
  generatedBy = 'maintainer',
} = {}) {
  if (!head) throw new Error('BOARD: main-Kopf fehlt');
  if (!at) throw new Error('BOARD: Zeitstempel fehlt');
  const openNumbers = new Set(issues.map((entry) => Number(entry.number)));
  const { kept, dropped } = pruneActiveClaims(previous.activeClaims ?? [], openNumbers);
  const openPrs = pullRequests
    .map(summarizePullRequest)
    .sort((left, right) => left.number - right.number);
  const state = {
    ...previous,
    version: 2,
    generatedAt: at,
    generatedBy,
    head,
    headMessage,
    base: `origin/main @ ${head}`,
    worktree: worktree ?? previous.worktree ?? null,
    activeClaims: kept,
    openPullRequests: openPrs.length,
    reviewWaitingPrs: openPrs.filter((entry) => entry.labels.includes('review-waiting')).length,
    openPrs,
    openIssuesCount: openNumbers.size,
  };
  return { state, dropped };
}

/**
 * Drift zwischen Datei und Live-Board. Nur belegbare Fakten zaehlen; Zeitstempel
 * und Prosa sind kein Drift, sonst meldet jeder Lauf denselben Befund.
 */
export function boardDrift({ previous = null, next = null, dropped = [] } = {}) {
  if (!previous) return ['board-state-missing'];
  if (!next) return ['board-state-missing'];
  const findings = [];
  if (previous.head !== next.head) findings.push(`head:${previous.head ?? 'none'}->${next.head}`);
  if (Number(previous.openIssuesCount ?? -1) !== next.openIssuesCount) {
    findings.push(`open-issues:${previous.openIssuesCount ?? 'none'}->${next.openIssuesCount}`);
  }
  if (Number(previous.openPullRequests ?? -1) !== next.openPullRequests) {
    findings.push(`open-prs:${previous.openPullRequests ?? 'none'}->${next.openPullRequests}`);
  }
  const documented = new Set((previous.openPrs ?? []).map((entry) => Number(entry.number)));
  for (const pullRequest of next.openPrs ?? []) {
    if (!documented.has(pullRequest.number)) findings.push(`missing-pr:#${pullRequest.number}`);
  }
  for (const claim of dropped) findings.push(`stale-claim:#${claim?.issue ?? 'unknown'}`);
  return findings;
}

/** Eine kanonische Datei: zwei Leerzeichen Einrueckung, genau ein Zeilenende. */
export function formatBoardState(state) {
  return `${JSON.stringify(state, null, 2)}\n`;
}
