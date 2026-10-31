/**
 * @test-target: scripts/lib/branch-prune.mjs
 * @error-code: ERR-4008
 *
 * Nach dem Merge mit gruenen Gates ist ein Wegwerf-Branch nur noch Arbeit, die
 * herumliegt. Geloescht wird jeder nach `main` gemergte Zweig; offene Arbeit,
 * `main` und der aktuelle Branch bleiben unangetastet.
 */
import { describe, expect, it } from 'vitest';
import { PROTECTED, parseBranches, prunable } from '../../../../scripts/lib/branch-prune.mjs';

describe('Wegwerf-Branches', () => {
  it('liest Namen und den Zustand des Upstreams', () => {
    const branches = parseBranches('main\t[gone]\nfeature/x\t[ahead 2]\nclean\t');
    expect(branches).toEqual([
      { name: 'main', upstreamGone: true },
      { name: 'feature/x', upstreamGone: false },
      { name: 'clean', upstreamGone: false },
    ]);
  });

  it('loescht jeden gemergten Zweig, offene Arbeit bleibt', () => {
    const targets = prunable([
      { name: 'p0-test-structure', merged: true, upstreamGone: true },
      { name: 'still-tracking', merged: true, upstreamGone: false },
      { name: 'unmerged', merged: false, upstreamGone: true },
    ]);
    expect(targets).toEqual(['p0-test-structure', 'still-tracking']);
  });

  it('schuetzt main und den aktuellen Branch', () => {
    const branches = [
      { name: 'main', merged: true, upstreamGone: true },
      { name: 'current', merged: true, upstreamGone: true },
    ];
    expect(PROTECTED).toContain('main');
    expect(prunable(branches, { current: 'current' })).toEqual([]);
  });
});
