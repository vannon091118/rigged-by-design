/**
 * Liest das GitHub-Board live, bewertet Claim und PR je Issue und waehlt das
 * naechste freie Issue. Kein lokaler Zustand.
 */
import { evaluateIssueClaim, orderBoard } from './issue-claim.mjs';
import { rest } from './github-rest.mjs';

const labelNames = (labels = []) => labels
  .map((label) => (typeof label === 'string' ? label : label?.name))
  .filter(Boolean);

const PRIORITY_REASON = Object.freeze({
  P0: 'Notfall: Save, RNG, Ledger, Boot oder Kernschleife betroffen',
  P1: 'wartender Review oder Gate, das mehrere Lanes blockiert',
  P2: 'Gameplay-Bug oder fehlender spielrelevanter Inhalt',
  P3: 'Board-/Governance-Struktur, die echte Arbeit blockiert',
  P4: 'ohne Prio-Label: nicht triagiert, deshalb nicht delegierbar',
});

const PHASE = Object.freeze({
  'zustand-open': 'OPEN_READY',
  'zustand-claimed': 'OPEN_CLAIMED',
  'zustand-block': 'OPEN_BLOCKED',
  'zustand-needs-info': 'OPEN_WAITING',
  'zustand-needs-evidence': 'OPEN_WAITING',
  'zustand-regression': 'OPEN_READY (Regression)',
  'zustand-rootcause': 'OPEN_READY (Root-Cause)',
});

function phaseOf(labels) {
  const lower = labels.map((label) => label.toLowerCase());
  if (lower.includes('review-waiting')) return 'REVIEW_WAITING';
  const state = lower.find((label) => label.startsWith('zustand-'));
  return state ? (PHASE[state] ?? state.toUpperCase()) : 'UNTRIAGED';
}

function prFor(number, pulls) {
  const branch = new RegExp(`(?:issue[-_/]|fix[-/])${number}(?!\\d)`, 'i');
  const body = new RegExp(`(?:closes|fixes|resolves|schliesst)\\s+#${number}(?!\\d)`, 'i');
  return pulls.find((pull) => branch.test(pull.headRefName ?? ''))
    ?? pulls.find((pull) => body.test(pull.body ?? ''))
    ?? null;
}

function nextActorOf({ claim, phase, pr, blocked }) {
  if (blocked) return 'User/Maintainer: Blocker (zustand-BLOCK) aufloesen';
  if (pr) return `Maintainer: PR #${pr.number} gegen das Issue pruefen`;
  if (phase === 'REVIEW_WAITING') return 'Maintainer: Label und PR-Lage in Deckung bringen';
  if (claim.status === 'claimed-other') return `Worker ${claim.holder} (${claim.claimId})`;
  if (claim.status === 'stale') return 'Maintainer: veralteten Claim freigeben, dann neu zuweisen';
  if (claim.status === 'free') return 'Freier Worker: CLAIM setzen, dann starten';
  if (claim.status === 'unknown') return 'Maintainer: Board nicht lesbar, Claim-Lage klaeren';
  return 'Maintainer: triagieren und zuweisen';
}

export function loadBoardState({ repo, agent, now, actors, wantedIssue, limit }) {
  const blockers = [];
  const warnings = [];
  let board = { ok: false, rows: [], pulls: [], total: 0 };
  const listed = rest('issue-list', { state: 'open', limit: 100, repo });
  if (!listed.ok) {
    blockers.push(`[ERR-4019] Board nicht lesbar (${listed.error}); kein Bericht aus Vermutungen`);
  } else {
    const issues = (Array.isArray(listed.data) ? listed.data : []).filter(
      (issue) => issue && (issue.labels || issue.title),
    );
    const pullsResult = rest('pr-list', { state: 'open', limit: 50, repo });
    const pulls = pullsResult.ok && Array.isArray(pullsResult.data) ? pullsResult.data : [];
    if (!pullsResult.ok) warnings.push(`Offene PRs nicht lesbar (${pullsResult.error}): Zeilen ohne PR-Bezug`);
    const ordered = orderBoard(issues);
    const selected = wantedIssue
      ? ordered.filter((issue) => Number(issue.number) === wantedIssue)
      : ordered.slice(0, limit);
    if (wantedIssue && selected.length === 0) {
      blockers.push(`[ERR-4019] Issue #${wantedIssue} ist nicht offen oder nicht lesbar`);
    }
    const rows = [];
    for (const issue of selected) {
      const detail = rest('issue-view', { number: Number(issue.number), repo });
      const labels = detail.ok ? labelNames(detail.data?.labels) : labelNames(issue.labels);
      const comments = detail.ok ? detail.data?.comments ?? [] : [];
      const claim = detail.ok
        ? evaluateIssueClaim({ comments, agent, now, staleHours: 2, actors })
        : { status: 'unknown', holder: null, claimId: null, error: detail.error, rejected: [] };
      if (!detail.ok) warnings.push(`Issue #${issue.number}: Verlauf nicht lesbar (${detail.error}); Claim unbekannt`);
      const phase = claim.status.startsWith('claimed') && phaseOf(labels) === 'OPEN_READY' ? 'OPEN_CLAIMED' : phaseOf(labels);
      const pr = prFor(Number(issue.number), pulls);
      const blocked = labels.some((label) => label.toLowerCase() === 'zustand-block');
      const reasons = [PRIORITY_REASON[issue.priority] ?? PRIORITY_REASON.P4];
      reasons.push(issue.createdAt ? `angelegt ${String(issue.createdAt).slice(0, 10)}` : 'ohne Anlagedatum');
      if (phase === 'REVIEW_WAITING') reasons.push('Uebergabe wartet auf Verdikt');
      if (pr) reasons.push(`offener PR #${pr.number} (${pr.headRefName})`);
      if (claim.status === 'free') reasons.push('kein Claim: frei');
      if (claim.status === 'claimed-other') reasons.push(`besetzt: ${claim.holder} ${claim.claimId} seit ${claim.since}`);
      if (claim.status === 'stale') reasons.push(`Claim ${claim.ageHours}h ohne Aktivitaet: nicht uebernehmen`);
      if (claim.status === 'unknown') reasons.push(`Claim-Lage unbekannt (${claim.error ?? 'Lesefehler'})`);
      if (blocked) reasons.push('zustand-BLOCK haelt die Lane an');
      rows.push({
        number: Number(issue.number),
        title: String(issue.title ?? ''),
        priority: issue.priority,
        phase,
        claim: {
          status: claim.status,
          holder: claim.holder ?? null,
          claimId: claim.claimId ?? null,
          since: claim.since ?? null,
          ageHours: claim.ageHours ?? null,
        },
        pr: pr ? { number: Number(pr.number), head: pr.headRefName, draft: Boolean(pr.draft) } : null,
        nextActor: nextActorOf({ claim, phase, pr, blocked }),
        reasons,
      });
    }
    board = { ok: true, rows, pulls, total: issues.length };
  }

  const next = board.rows.find(
    (row) => row.claim.status === 'free' && !row.pr && row.phase !== 'OPEN_BLOCKED' && row.phase !== 'REVIEW_WAITING',
  ) ?? null;

  if (wantedIssue) {
    const row = board.rows.find((entry) => entry.number === wantedIssue);
    if (row && row.claim.status === 'claimed-other') {
      blockers.push(
        `[ERR-4019] Issue #${row.number} haelt ${row.claim.holder} (${row.claim.claimId}); ` +
          `erst RELEASE/HANDOFF im Issue abwarten. Alternative: \`pnpm run agent:start -- --issue ${next?.number ?? '<nr>'}\``,
      );
    } else if (row && row.claim.status === 'stale') {
      blockers.push(
        `[ERR-4019] Issue #${row.number}: Claim von ${row.claim.holder} ist ${row.claim.ageHours}h alt; ` +
          `Maintainer gibt frei: \`gh issue comment ${row.number} --body "RELEASE [${row.claim.claimId}] abandoned stale"\``,
      );
    } else if (row && row.pr) {
      blockers.push(`[ERR-4019] Issue #${row.number} haengt an PR #${row.pr.number}: Merge/Review liegt beim Maintainer, keine neue Lane`);
    }
  } else if (board.ok && board.rows.length > 0 && !next) {
    warnings.push('Kein freies Issue in den gezeigten Zeilen; alle Kandidaten sind besetzt oder warten auf Review.');
  }
  return { board, next, blockers, warnings };
}
