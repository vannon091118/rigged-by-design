/** @test-target: scripts/lib/affected-tests.mjs | @error-code: ERR-4002 */
import { describe, expect, it } from 'vitest';
import { selectAffectedTests } from '../../../../scripts/lib/affected-tests.mjs';
import { partitionByProof, proofClassOf } from '../../../../scripts/lib/test-catalog.mjs';

describe('Impact-Auswahl fuer Agenten und Gates', () => {
  it('laesst reine Doku ohne Testlauf', () => {
    const selection = selectAffectedTests(['docs/CHANGELOG.md', 'README.md']);
    expect(selection.tests).toHaveLength(0);
    expect(selection.runAll).toBe(false);
  });

  it('faellt bei einer Konfigurationsaenderung auf alle Tests zurueck', () => {
    const selection = selectAffectedTests(['package.json']);
    expect(selection.runAll).toBe(true);
    expect(selection.tests.length).toBeGreaterThan(0);
  });

  it('findet ueber den Importgraphen mindestens einen Save-Test', () => {
    const selection = selectAffectedTests(['src/store/save.ts']);
    expect(selection.tests.some((file) => file.includes('save'))).toBe(true);
  });

  it('trennt lange Nachweise von lokal laufbaren Tests', () => {
    const split = partitionByProof([
      'src/core/games/__tests__/round-rtp-high.test.ts',
      'src/core/sim/__tests__/narrative-start-pool.test.ts',
    ]);
    expect(split.long).toContain('src/core/games/__tests__/round-rtp-high.test.ts');
    expect(split.fast).toContain('src/core/sim/__tests__/narrative-start-pool.test.ts');
    expect(proofClassOf('src/core/games/__tests__/round-rtp-high.test.ts')).toBe('statistics');
  });
});
