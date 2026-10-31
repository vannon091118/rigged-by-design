/**
 * @test-target: scripts/lib/test-catalog.mjs
 * @error-code: ERR-4015
 *
 * Jede Testdatei gehoert genau einem System und genau einer Beweisklasse.
 * Statistik- und Messlaeufe werden nicht lokal gerechnet, sondern an CI
 * delegiert; der Katalog macht diese Grenze sichtbar und pruefbar.
 */
import { describe, expect, it } from 'vitest';
import {
  LONG_PROOF_CLASSES,
  PROOF_CLASSES,
  catalogEntries,
  partitionByProof,
  proofClassOf,
  renderCatalog,
  systemOfTarget,
} from '../../../../scripts/lib/test-catalog.mjs';

describe('Testkatalog', () => {
  it('ordnet Systeme anhand des deklarierten Ziels zu', () => {
    expect(systemOfTarget('src/core/games/round.ts')).toBe('games');
    expect(systemOfTarget('scripts/lib/gate-runner.mjs')).toBe('pipeline');
    expect(systemOfTarget('.github/workflows/ci-verify.yml')).toBe('ci');
    expect(systemOfTarget('src/core/sim/tick.ts')).toBe('sim');
    expect(systemOfTarget(null)).toBe('unknown');
  });

  it('erkennt Statistik- und Messlaeufe an ihrer Rolle', () => {
    expect(proofClassOf('src/core/games/__tests__/round-rtp-high.test.ts')).toBe('statistics');
    expect(proofClassOf('src/core/games/__tests__/poker-distribution.test.ts')).toBe('statistics');
    expect(proofClassOf('src/core/sim/__tests__/soak.test.ts')).toBe('statistics');
    expect(proofClassOf('src/store/memory.bench.ts')).toBe('performance');
    expect(proofClassOf('src/core/governance/__tests__/ci-gates.test.ts')).toBe('governance');
    expect(proofClassOf('src/ui/__tests__/ui.test.tsx')).toBe('integration');
    expect(proofClassOf('src/core/rng/__tests__/shoe.test.ts')).toBe('contract');
  });

  it('gibt jeder Testdatei genau eine Klasse und ein System', () => {
    const entries = catalogEntries();
    expect(entries.length).toBeGreaterThan(60);
    expect(new Set(entries.map((entry) => entry.file)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(PROOF_CLASSES, `${entry.file} ohne gueltige Klasse`).toContain(entry.proof);
      expect(entry.system, `${entry.file} ohne System`).not.toBe('unknown');
      expect(entry.long).toBe(LONG_PROOF_CLASSES.includes(entry.proof));
    }
  });

  it('trennt lokale Nachweise von den an CI delegierten', () => {
    const split = partitionByProof([
      'src/core/rng/__tests__/shoe.test.ts',
      'src/core/sim/__tests__/soak.test.ts',
      'src/store/memory.bench.ts',
    ]);
    expect(split.fast).toEqual(['src/core/rng/__tests__/shoe.test.ts']);
    expect(split.long).toEqual(['src/core/sim/__tests__/soak.test.ts', 'src/store/memory.bench.ts']);
  });

  it('rendert eine Tabelle mit Markern und einer Summenzeile', () => {
    const block = renderCatalog();
    expect(block).toContain('<!-- TEST_CATALOG_START -->');
    expect(block).toContain('<!-- TEST_CATALOG_END -->');
    expect(block).toContain('| Testdatei | System | Beweisklasse | Lokal | Deklariertes Ziel |');
    expect(block).toMatch(/Summe: \d+ Dateien/);
    expect(block).toMatch(/round-rtp-high\.test\.ts` \| games \| statistics \| nein, CI \|/);
  });
});
