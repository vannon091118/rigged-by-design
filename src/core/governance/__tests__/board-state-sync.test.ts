/**
 * @test-target: scripts/lib/board-state.mjs
 * @error-code: ERR-4019
 *
 * #834: Der Board-Snapshot kommt aus dem Live-Board. Offene Issues und Pull
 * Requests werden gezaehlt, Claims auf geschlossene Issues fallen heraus, und
 * `--check` findet genau diese Abweichungen wieder.
 */
import { describe, expect, it } from 'vitest';
import {
  boardDrift, formatBoardState, isPullRequest, nextBoardState, pruneActiveClaims, splitBoard,
} from '../../../../scripts/lib/board-state.mjs';

const AT = '2026-11-15T04:00:00Z';
const HEAD = 'a'.repeat(40);
const issue = (number: number) => ({ number, title: `#${number}`, labels: [{ name: 'prio-P1' }], pullRequest: null });
const pull = (number: number, labels: string[] = []) => ({
  number,
  title: `PR ${number}`,
  labels: labels.map((name) => ({ name })),
  pullRequest: { merged_at: null },
  head: { ref: `lane/${number}` },
  draft: false,
});

describe('Board-State (#834)', () => {
  it('trennt Issues und Pull Requests', () => {
    expect(isPullRequest(pull(9))).toBe(true);
    expect(isPullRequest(issue(9))).toBe(false);
    const split = splitBoard([issue(1), pull(2)]);
    expect(split.issues).toHaveLength(1);
    expect(split.pullRequests).toHaveLength(1);
  });

  it('zieht Kopf, Zaehler und offene PRs aus dem Live-Board nach', () => {
    const { state, dropped } = nextBoardState({
      previous: { summary: 'alt', activeClaims: [{ issue: 1, worker: 'Jenova' }] },
      issues: [issue(1), issue(2)],
      pullRequests: [pull(30, ['review-waiting']), pull(20)],
      head: HEAD,
      headMessage: 'Merge PR #1',
      at: AT,
    });
    expect(state).toMatchObject({
      head: HEAD,
      base: `origin/main @ ${HEAD}`,
      openIssuesCount: 2,
      openPullRequests: 2,
      reviewWaitingPrs: 1,
      summary: 'alt',
    });
    expect(state.openPrs.map((entry: { number: number }) => entry.number)).toEqual([20, 30]);
    expect(dropped).toEqual([]);
  });

  it('entfernt Claims fuer geschlossene Issues', () => {
    const pruned = pruneActiveClaims([{ issue: 1 }, { issue: 693 }, { issue: 'x' }], new Set([1]));
    expect(pruned.kept).toEqual([{ issue: 1 }]);
    expect(pruned.dropped.map((claim: { issue: number | string }) => claim.issue)).toEqual([693, 'x']);
  });

  it('meldet Drift gegen die Datei, nicht gegen den Zeitstempel', () => {
    const previous = {
      head: 'b'.repeat(40), openIssuesCount: 1, openPullRequests: 0, openPrs: [], generatedAt: 'alt',
    };
    const { state, dropped } = nextBoardState({
      previous: { ...previous, activeClaims: [{ issue: 99 }] },
      issues: [issue(1), issue(2)],
      pullRequests: [pull(5)],
      head: HEAD,
      at: AT,
    });
    const drift = boardDrift({ previous, next: state, dropped });
    expect(drift).toEqual(expect.arrayContaining([
      `head:${'b'.repeat(40)}->${HEAD}`,
      'open-issues:1->2',
      'open-prs:0->1',
      'missing-pr:#5',
      'stale-claim:#99',
    ]));
    expect(boardDrift({ previous: state, next: state, dropped: [] })).toEqual([]);
    expect(boardDrift({ previous: null, next: state })).toEqual(['board-state-missing']);
  });

  it('verlangt Kopf und Zeitstempel und schreibt genau eine Datei', () => {
    expect(() => nextBoardState({ issues: [], pullRequests: [], at: AT })).toThrow(/main-Kopf/);
    expect(() => nextBoardState({ issues: [], pullRequests: [], head: HEAD })).toThrow(/Zeitstempel/);
    const { state } = nextBoardState({ previous: {}, issues: [], pullRequests: [], head: HEAD, at: AT });
    const formatted = formatBoardState(state);
    expect(formatted.endsWith('\n')).toBe(true);
    expect(JSON.parse(formatted).openIssuesCount).toBe(0);
  });

  it('akzeptiert head == main^ als dokumentierte Closeout-Relation', () => {
    const previous = { head: 'parent-sha', openIssuesCount: 16, openPullRequests: 0, openPrs: [] };
    const next = { head: 'merge-sha', openIssuesCount: 16, openPullRequests: 0, openPrs: [] };
    expect(boardDrift({ previous, next, headParents: ['parent-sha'] })).toEqual([]);
    expect(boardDrift({ previous, next, headParents: ['andere-sha'] })).toEqual(['head:parent-sha->merge-sha']);
  });
});
