/**
 * @test-target: scripts/lib/claim-evidence.mjs
 * @error-code: ERR-4019
 *
 * Ein Branch-Name, zwei gemergte PRs: Für die Identität eines Claims bleibt das
 * mehrdeutig, als Merge-Beleg für die Kollisionsprüfung reicht es, wenn jede
 * Fassung auf `main` liegt. Ohne diese Trennung blockiert ein veralteter Claim
 * jede Lane mit denselben Pfaden — genau das war passiert.
 */
import { describe, expect, it } from 'vitest';
import { filterMergedCollisions } from '../../../../scripts/lib/claim-evidence.mjs';

describe('Mehrdeutiger Merge-Beleg', () => {
  it('wertet einen vollstaendig gemergten PR-Verlauf als Merge-Beleg', () => {
    const b = 'b'.repeat(40);
    const d = 'd'.repeat(40);
    const base = 'e'.repeat(40);
    const git = (args: string[]) => {
      const key = args.join(' ');
      if (key.startsWith('rev-parse --verify')) throw new Error('kein Ref');
      if (key === 'rev-parse origin/main') return base;
      if (key === 'ls-remote --heads origin lane/wiederverwendet') return '';
      if (key === `merge-base --is-ancestor ${b} origin/main`) return '';
      if (key === `merge-base --is-ancestor ${d} origin/main`) return '';
      return '';
    };
    const collisions = filterMergedCollisions({
      collisions: [{ lane: 'lane/wiederverwendet', reason: 'Pfad-Ueberschneidung in Allowlist', contractConflict: [] }],
      claims: [{ id: 'lane/wiederverwendet', branch: 'lane/wiederverwendet', baseSha: base, status: 'open' }],
      baseRef: 'origin/main',
      git,
      prIndex: new Map(),
      prGroups: new Map([
        ['lane/wiederverwendet', [
          { number: 1, headRefOid: 'a'.repeat(40), mergeCommit: b },
          { number: 2, headRefOid: 'c'.repeat(40), mergeCommit: d },
        ]],
      ]),
    });
    expect(collisions).toEqual([]);
  });

  it('laesst die Kollision stehen, wenn eine Fassung nicht auf main liegt', () => {
    const b = 'b'.repeat(40);
    const base = 'e'.repeat(40);
    const git = (args: string[]) => {
      const key = args.join(' ');
      if (key.startsWith('rev-parse --verify')) throw new Error('kein Ref');
      if (key === 'rev-parse origin/main') return base;
      if (key === 'ls-remote --heads origin lane/wiederverwendet') return '';
      if (key === `merge-base --is-ancestor ${b} origin/main`) return '';
      if (key === `merge-base --is-ancestor ${'f'.repeat(40)} origin/main`) throw new Error('nicht auf main');
      return '';
    };
    const collisions = filterMergedCollisions({
      collisions: [{ lane: 'lane/wiederverwendet', reason: 'Pfad-Ueberschneidung in Allowlist', contractConflict: [] }],
      claims: [{ id: 'lane/wiederverwendet', branch: 'lane/wiederverwendet', baseSha: base, status: 'open' }],
      baseRef: 'origin/main',
      git,
      prIndex: new Map(),
      prGroups: new Map([
        ['lane/wiederverwendet', [
          { number: 1, headRefOid: 'a'.repeat(40), mergeCommit: b },
          { number: 2, headRefOid: 'c'.repeat(40), mergeCommit: 'f'.repeat(40) },
        ]],
      ]),
    });
    expect(collisions).toHaveLength(1);
  });
});
