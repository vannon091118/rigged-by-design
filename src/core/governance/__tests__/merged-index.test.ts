/**
 * @test-target: scripts/lib/merged-index.mjs
 * @error-code: ERR-4028
 *
 * Der Merge-Beleg-Index ist nur brauchbar, wenn er aus echten Merge-Commits
 * entsteht, fremde Forks ausschliesst und derselbe Git-Stand dieselben Bytes
 * erzeugt. Fehlende oder beschaedigte Indizes bleiben fail-closed.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergedPullRequestIndex } from '../../../../scripts/lib/claim-evidence.mjs';
import {
  buildMergedIndex,
  mergedIndexGroups,
  parseMergeSubject,
  readMergedIndex,
  syncMergedIndex,
} from '../../../../scripts/lib/merged-index.mjs';

const MERGE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const OTHER_HEAD = 'c'.repeat(40);

function fakeGit(output: string) {
  return (args: string[]) => {
    if (args[0] === 'log') return output;
    throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`);
  };
}

describe('merged-index', () => {
  it('parst nur das Standard-Merge-Subject', () => {
    expect(parseMergeSubject('Merge pull request #42 from vannon091118/lane/foo')).toEqual({
      number: 42,
      owner: 'vannon091118',
      branch: 'lane/foo',
    });
    expect(parseMergeSubject('Merge branch main')).toBeNull();
    expect(parseMergeSubject('Merge pull request #0 from owner/lane')).toBeNull();
  });

  it('baut den Index deterministisch aus eigenen Merge-Commits', () => {
    const git = fakeGit(
      [
        `${MERGE}\tparent0 ${HEAD}\tMerge pull request #42 from vannon091118/lane/zwei`,
        `${'d'.repeat(40)}\tparent0 ${OTHER_HEAD}\tMerge pull request #7 from vannon091118/lane/eins`,
        `${'e'.repeat(40)}\tparent0 ${'f'.repeat(40)}\tMerge pull request #8 from fremd/lane/fork`,
        `${'1'.repeat(40)}\tparent0 ${'2'.repeat(40)}\tMerge branch main`,
      ].join('\n'),
    );
    const first = buildMergedIndex({ git, owner: 'vannon091118' });
    const second = buildMergedIndex({ git, owner: 'vannon091118' });
    expect(first).toEqual(second);
    expect(first.entries.map((entry: { number: number }) => entry.number)).toEqual([7, 42]);
    expect(first.entries[0]).toEqual({
      branch: 'lane/eins',
      number: 7,
      headSha: OTHER_HEAD,
      mergeSha: 'd'.repeat(40),
    });
  });

  it('behauptet ohne bekannten Repository-Owner keinen Beleg', () => {
    const index = buildMergedIndex({
      git: fakeGit(`${MERGE}\tparent0 ${HEAD}\tMerge pull request #1 from owner/lane`),
      owner: null,
    });
    expect(index.entries).toEqual([]);
  });

  it('macht aus dem Index die claim-evidence-Map', () => {
    const index = {
      version: 1,
      source: 'git-merge-commits',
      entries: [{ branch: 'lane/foo', number: 9, headSha: HEAD, mergeSha: MERGE }],
    };
    expect(mergedIndexGroups(index)?.get('lane/foo')).toEqual([
      { number: 9, headRefOid: HEAD, mergeCommit: MERGE, url: null },
    ]);
    expect(mergedIndexGroups({ ...index, entries: [{ branch: 'lane/foo' }] })).toBeNull();
  });

  it('faellt in claim-evidence ohne gh auf den lokalen Index zurueck', () => {
    const index = mergedPullRequestIndex({
      gh: () => {
        throw new Error('gh fehlt');
      },
      indexData: {
        version: 1,
        source: 'git-merge-commits',
        entries: [
          { branch: 'lane/lokal', number: 42, headSha: 'a'.repeat(40), mergeSha: 'b'.repeat(40) },
        ],
      },
    });
    expect(index?.get('lane/lokal')).toEqual({
      number: 42,
      headRefOid: 'a'.repeat(40),
      mergeCommit: 'b'.repeat(40),
      url: null,
    });
  });

  it('liest fehlende und beschaedigte Indizes fail-closed', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-merged-index-'));
    try {
      expect(readMergedIndex({ root })).toBeNull();
      writeFileSync(join(root, 'merged-index.json'), '{"version":1,"entries":[{"branch":""}]}');
      expect(readMergedIndex({ root, file: 'merged-index.json' })).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ueberschreibt einen belegten Index nicht mit einem leeren Neuaufbau', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-merged-index-'));
    const file = 'merged-index.json';
    const index = {
      version: 1,
      source: 'git-merge-commits',
      entries: [{ branch: 'lane/foo', number: 42, headSha: HEAD, mergeSha: MERGE }],
    };
    writeFileSync(join(root, file), JSON.stringify(index));
    try {
      const result = syncMergedIndex({
        root,
        file,
        owner: 'vannon091118',
        git: () => {
          throw new Error('origin/main fehlt');
        },
      });
      expect(result.changed).toBe(false);
      expect(readMergedIndex({ root, file })?.entries).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('schreibt den Index idempotent und meldet Veraltung im Check-Modus', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-merged-index-'));
    const git = fakeGit(`${MERGE}\tparent0 ${HEAD}\tMerge pull request #5 from vannon091118/lane/foo`);
    try {
      const written = syncMergedIndex({ root, file: 'index.json', git, owner: 'vannon091118' });
      expect(written.changed).toBe(true);
      expect(syncMergedIndex({ root, file: 'index.json', git, owner: 'vannon091118' }).changed).toBe(false);
      expect(syncMergedIndex({ root, file: 'index.json', git, owner: 'vannon091118', check: true }).changed).toBe(false);
      writeFileSync(join(root, 'index.json'), '{}');
      expect(syncMergedIndex({ root, file: 'index.json', git, owner: 'vannon091118', check: true }).changed).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
