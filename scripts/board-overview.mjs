#!/usr/bin/env node
/**
 * board:overview — die eine erklaerte Arbeitsuebersicht (#943).
 *
 * `pretask` beantwortet lokal: Arbeitsbaum, Budget, Scope, Claim-Startgate.
 * Diese Datei beantwortet die Board-Haelfte derselben Frage, serverlos:
 * Welche Issues stehen in welcher Reihenfolge an, wem gehoeren sie, welcher PR
 * haengt daran, wer ist der naechste Akteur — und **warum**.
 *
 * Grundsaetze:
 * - Kein Uhrenlesen. Die Zeit kommt aus `--at`/`RBD_NOW`, sonst aus dem
 *   Committer-Datum des Kopfes. Derselbe Board-Stand ergibt dieselbe Ausgabe.
 * - Fail-closed. Ein nicht lesbares Board endet mit Exit 2, nie mit einem
 *   leeren Erfolg; der Zustand `unknown` wird ausgewiesen, nicht geraten.
 * - Eine Wahrheit. Claims werden mit demselben Parser bewertet wie in
 *   `pretask` (`evaluateIssueClaim`), Prioritaet und Reihenfolge mit
 *   `boardRank`. Dieses Skript erfindet keine zweite Klassifikation.
 *
 * Aufruf:
 *   node scripts/board-overview.mjs --markdown --limit 12
 *   node scripts/board-overview.mjs --json --at 2026-11-16T01:00:00Z
 *   RBD_NOW=2026-11-16T01:00:00Z pnpm run board:overview
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';
import { boardRank, evaluateIssueClaim } from './lib/issue-claim.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const REPO = value('repo', process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design');
const LIMIT = Number(value('limit', '12'));
// Ohne `--json` ist die Ausgabe Markdown; `--markdown` bleibt als expliziter
// Schalter lesbar, damit der Workflow die Absicht nennt.
const json = flag('json');
const atFlag = value('at', process.env.RBD_NOW ?? null);

/** Ein kontrollierter `gh`-Aufruf; Fehler bleiben Fehler. */
function gh(args) {
  const bin = process.env.RBD_GH_BIN || 'gh';
  const full = process.env.RBD_GH_SCRIPT ? [process.env.RBD_GH_SCRIPT, ...args] : args;
  try {
    const output = execFileSync(bin, full, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: true, data: JSON.parse(output) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.split('\n')[0] : 'unbekannt' };
  }
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const ACTORS_FILE = join(ROOT, '.lane-claims', 'actors.json');
function loadActors() {
  if (!existsSync(ACTORS_FILE)) return { policyMissing: true, actors: {} };
  try {
    const parsed = JSON.parse(readFileSync(ACTORS_FILE, 'utf8'));
    return { policyMissing: false, actors: parsed?.actors ?? parsed ?? {} };
  } catch (error) {
    return { policyMissing: true, actors: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

const labelsOf = (issue) => (issue?.labels ?? [])
  .map((label) => (typeof label === 'string' ? label : label?.name))
  .filter(Boolean);

const PRIORITY_REASON = Object.freeze({
  P0: 'Notfall oder Richtungsentscheidung: Save, RNG, Ledger, Boot oder Kernschleife betroffen',
  P1: 'wartender Review oder ein Gate, das mehrere Lanes blockiert',
  P2: 'Gameplay-Bug oder fehlender spielrelevanter Inhalt',
  P3: 'Board-/Governance-Struktur, die echte Arbeit blockiert',
  P4: 'ohne Prioritaets-Label: nicht triagiert, deshalb nicht delegierbar',
});

const PHASE_LABEL = Object.freeze({
  'zustand-open': 'OPEN_READY',
  'zustand-claimed': 'OPEN_CLAIMED',
  'zustand-block': 'OPEN_BLOCKED',
  'zustand-needs-info': 'OPEN_WAITING',
  'zustand-needs-evidence': 'OPEN_WAITING',
  'zustand-regression': 'OPEN_READY (Regression)',
  'zustand-rootcause': 'OPEN_READY (Root-Cause)',
  'zustand-closed': 'CLOSED',
});

/** Phase aus den Badges; `review-waiting` ist ein Uebergang, kein Zustand. */
function phaseOf(labels) {
  const lower = labels.map((label) => label.toLowerCase());
  if (lower.includes('review-waiting')) return 'REVIEW_WAITING';
  const state = lower.find((label) => label.startsWith('zustand-'));
  return state ? (PHASE_LABEL[state] ?? state.toUpperCase()) : 'UNTRIAGED';
}

/**
 * Der PR, der dieses Issue traegt. Zuerst das Branch-Schema (eindeutig),
 * erst danach ein ausdruecklicher Verweis im PR-Body. Eine beilaeufige
 * Erwaehnung ("siehe #803") darf keinen PR zuordnen.
 */
function prFor(issueNumber, pullRequests) {
  const branch = new RegExp(`(?:issue[-_/]|fix[-/])${issueNumber}(?!\\d)`, 'i');
  const body = new RegExp(`(?:closes|fixes|resolves|schliesst)\\s+#${issueNumber}(?!\\d)`, 'i');
  return pullRequests.find((pr) => branch.test(pr.headRefName ?? ''))
    ?? pullRequests.find((pr) => body.test(pr.body ?? ''))
    ?? null;
}

/** Ein Claim, der das Issue gerade besetzt (eigener oder fremder Halter). */
function heldClaim(claim) {
  return claim?.status === 'claimed-other' || claim?.status === 'claimed-self';
}
function nextActorOf({ claim, phase, pr, blocked }) {
  if (blocked) return 'User/Maintainer: Entscheidung oder Blocker aufloesen';
  if (pr) return `Maintainer: PR #${pr.number} gegen das Issue pruefen`;
  if (phase === 'REVIEW_WAITING') return 'Maintainer: Label und PR-Lage in Deckung bringen';
  if (claim.status === 'claimed-other') return `Worker ${claim.holder} (${claim.claimId ?? 'Claim'})`;
  if (claim.status === 'stale') return 'Maintainer: veralteten Claim freigeben, dann neu zuweisen';
  if (claim.status === 'free') return 'Freier Worker: CLAIM setzen, dann starten';
  if (claim.status === 'unknown') return 'Maintainer: Board nicht lesbar, Claim-Lage klaeren';
  return 'Maintainer: triagieren und zuweisen';
}

/** Warum dieses Issue jetzt dran ist — aus Fakten, nicht aus Prosa. */
function reasonsOf({ rank, claim, pr, phase, blocked, issue, oldestOfPriority }) {
  const reasons = [PRIORITY_REASON[rank.priority] ?? PRIORITY_REASON.P4];
  const age = issue.createdAt ? `angelegt ${String(issue.createdAt).slice(0, 10)}` : 'ohne Anlagedatum';
  reasons.push(oldestOfPriority ? `aeltestes offenes Issue dieser Stufe (${age})` : age);
  if (phase === 'REVIEW_WAITING') reasons.push('Uebergabe wartet auf Verdikt');
  if (pr) reasons.push(`offener PR #${pr.number} (${pr.headRefName})`);
  if (claim.status === 'claimed-other') reasons.push(`besetzt: ${claim.holder} ${claim.claimId ?? ''} ${claim.since ? `seit ${claim.since}` : ''}`.trim());
  if (claim.status === 'stale') reasons.push(`Claim ${claim.ageHours}h ohne Aktivitaet: nicht uebernehmen`);
  if (claim.status === 'free') reasons.push('kein Claim: frei');
  if (claim.status === 'unknown') reasons.push(`Claim-Lage unbekannt (${claim.error ?? 'Lesefehler'})`);
  if (blocked) reasons.push('Badge zustand-BLOCK: haelt die Lane an');
  return reasons;
}

// --- Board lesen ---------------------------------------------------------
const listing = gh(['api', '--paginate', `repos/${REPO}/issues?state=open&per_page=100`]);
if (!listing.ok || !Array.isArray(listing.data)) {
  console.error(`BOARD-OVERVIEW: offene Issues nicht lesbar (${listing.error ?? 'kein Array'}); kein Bericht aus Vermutungen`);
  process.exit(2);
}
const entries = listing.data;
const issues = entries.filter((entry) => !entry.pull_request);
const pulls = gh(['pr', 'list', '--repo', REPO, '--state', 'open', '--limit', '50',
  '--json', 'number,title,headRefName,headRefOid,isDraft,labels,body,updatedAt']);
if (!pulls.ok) {
  console.error(`BOARD-OVERVIEW: offene PRs nicht lesbar (${pulls.error}); kein Bericht aus Vermutungen`);
  process.exit(2);
}
const pullRequests = Array.isArray(pulls.data) ? pulls.data : [];

const head = git(['rev-parse', 'origin/main']) || git(['rev-parse', 'HEAD']);
const at = atFlag ?? git(['log', '-1', '--format=%cI', 'HEAD']) ?? null;
if (!at || Number.isNaN(Date.parse(at))) {
  console.error('BOARD-OVERVIEW: --at/RBD_NOW fehlt und der Kopf hat kein Committer-Datum');
  process.exit(2);
}
const now = Date.parse(at);
const { policyMissing, actors } = loadActors();

// Board-Reihenfolge: Prioritaet, dann Zustand, dann Alter. Das ist dieselbe
// Funktion, die pretask fuer seine Kandidatenliste nutzt.
const ordered = issues
  .map((issue) => ({ issue, rank: boardRank(issue) }))
  .sort((left, right) => left.rank.rank[0] - right.rank.rank[0]
    || left.rank.rank[1] - right.rank.rank[1]
    || String(left.issue.createdAt ?? '').localeCompare(String(right.issue.createdAt ?? ''))
    || Number(left.issue.number ?? 0) - Number(right.issue.number ?? 0));

const top = ordered.slice(0, Math.max(1, LIMIT));
// Nur das jeweils aelteste Issue einer Stufe darf sich so nennen.
const oldestByPriority = new Map();
for (const entry of ordered) {
  if (!oldestByPriority.has(entry.rank.priority)) oldestByPriority.set(entry.rank.priority, Number(entry.issue.number));
}
const rows = [];
for (const { issue, rank } of top) {
  const detail = gh(['issue', 'view', String(issue.number), '--repo', REPO,
    '--json', 'number,title,state,labels,comments,createdAt,updatedAt,body']);
  if (!detail.ok) {
    console.error(`BOARD-OVERVIEW: Issue #${issue.number} nicht lesbar (${detail.error})`);
    process.exit(2);
  }
  const labels = labelsOf(detail.data);
  const claim = evaluateIssueClaim({
    comments: detail.data.comments ?? [], agent: '', now, staleHours: 2, actors,
  });
  const phase = heldClaim(claim) && phaseOf(labels) === 'OPEN_READY' ? 'OPEN_CLAIMED' : phaseOf(labels);
  const pr = prFor(Number(issue.number), pullRequests);
  const blocked = labels.some((label) => label.toLowerCase() === 'zustand-block');
  rows.push({
    number: Number(issue.number),
    title: String(detail.data.title ?? ''),
    priority: rank.priority,
    phase,
    labels,
    claim: {
      status: claim.status,
      holder: claim.holder ?? null,
      claimId: claim.claimId ?? null,
      since: claim.since ?? null,
      ageHours: claim.ageHours ?? null,
      error: claim.error ?? null,
    },
    pr: pr ? { number: Number(pr.number), head: pr.headRefName, sha: pr.headRefOid, draft: Boolean(pr.isDraft) } : null,
    nextActor: nextActorOf({ claim, phase, pr, blocked }),
    reasons: reasonsOf({
      rank, claim, pr, phase, blocked, issue: detail.data,
      oldestOfPriority: oldestByPriority.get(rank.priority) === Number(issue.number),
    }),
  });
}

const claimsActive = rows.filter((row) => row.claim.status === 'claimed-other'
  || row.claim.status === 'claimed-self').length;const overview = {
  repo: REPO,
  at,
  head: head || null,
  counts: {
    openIssues: issues.length,
    openPullRequests: pullRequests.length,
    shown: rows.length,
    activeClaimsShown: claimsActive,
  },
  actorPolicy: policyMissing ? 'MISSING (Claim-Bewertung fail-closed)' : 'ok',
  rows,
  warnings: [
    ...(policyMissing ? ['`.lane-claims/actors.json` fehlt oder ist unlesbar: Claims bleiben wirkungslos.'] : []),
    ...(rows.some((row) => row.phase === 'REVIEW_WAITING' && !row.pr)
      ? ['`review-waiting` ohne offenen PR: Label und PR-Lage widersprechen sich.'] : []),
    ...(rows.some((row) => row.claim.status === 'unknown')
      ? ['Mindestens ein Claim ist nicht bewertbar; das ist ein Lesefehler, kein Freibrief.'] : []),
  ],
  readPaths: [
    'Board-Wahrheit: GitHub-Issue inklusive Kommentaren (CLAIM/RELEASE/HANDOFF).',
    'Abgeleitet: `.lane-claims/board-state.json` via `pnpm run board:sync`.',
    'Lokal verbindlich bleibt `pnpm run agent:pretask --json` (Arbeitsbaum, Budget, Scope).',
  ],
};

// --- Ausgabe -------------------------------------------------------------
if (json) {
  console.log(JSON.stringify(overview, null, 2));
  process.exit(0);
}

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const claimCell = (claim) => {
  if (claim.status === 'claimed-other' || claim.status === 'claimed-self') {
    return `${claim.holder} ${claim.claimId ?? ''}`.trim();
  }
  if (claim.status === 'stale') return `stale (${claim.holder}, ${claim.ageHours}h)`;
  if (claim.status === 'free') return 'frei';
  if (claim.status === 'unknown') return 'unknown';
  return claim.status;
};

const lines = [];
lines.push('<!-- rbd:board-overview -->');
lines.push('# Board-Übersicht');
lines.push('');
lines.push(`**Stand:** ${at} · **main:** ${head ? `\`${head.slice(0, 8)}\`` : 'unbekannt'} · **Offen:** ${overview.counts.openIssues} Issues, ${overview.counts.openPullRequests} PRs · **Aktive Claims (gezeigt):** ${claimsActive}`);
lines.push('');
lines.push('Automatisch erzeugt aus GitHub-Ereignissen. Bei Abweichung gewinnt das Issue; diese Übersicht ersetzt nur das Lesen, nicht das Prüfen.');
lines.push('');
lines.push('## Arbeitsreihenfolge');
lines.push('');
lines.push('| # | Prio | Phase | Claim | PR | Nächster Akteur | Warum |');
lines.push('| --- | --- | --- | --- | --- | --- | --- |');
for (const row of rows) {
  const pr = row.pr ? `#${row.pr.number}${row.pr.draft ? ' (draft)' : ''}` : '—';
  lines.push(`| #${row.number} | ${row.priority} | ${row.phase} | ${cell(claimCell(row.claim))} | ${pr} | ${cell(row.nextActor)} | ${cell(row.reasons.join(' · '))} |`);
}
lines.push('');
lines.push(`## Wartende Reviews`);
lines.push('');
const reviews = rows.filter((row) => row.phase === 'REVIEW_WAITING' || row.pr);
if (reviews.length === 0) lines.push('Keine wartenden Reviews in den gezeigten Issues.');
for (const row of reviews) {
  lines.push(`- #${row.number} ${row.title} — ${row.pr ? `PR #${row.pr.number}` : 'kein PR'} · ${row.nextActor}`);
}
lines.push('');
lines.push('## Blockiert');
lines.push('');
const blockedRows = rows.filter((row) => row.phase.startsWith('OPEN_BLOCKED'));
if (blockedRows.length === 0) lines.push('Keine blockierten Issues in den gezeigten Zeilen.');
for (const row of blockedRows) lines.push(`- #${row.number} ${row.title} — ${row.nextActor}`);
lines.push('');
lines.push('## Lesewege');
lines.push('');
for (const path of overview.readPaths) lines.push(`- ${path}`);
if (overview.warnings.length > 0) {
  lines.push('');
  lines.push('## Hinweise');
  lines.push('');
  for (const warning of overview.warnings) lines.push(`- ${warning}`);
}
console.log(lines.join('\n'));
