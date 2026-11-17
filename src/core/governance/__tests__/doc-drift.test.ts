/**
 * @test-target: scripts/lib/doc-drift.mjs
 * @error-code: ERR-4023
 *
 * Die Drift-Regel ist der Merge-Schutz des Doku-Kerns: eine Codeaenderung ohne
 * Zeile in LAST-CHANGES blockiert, eine Spiel-Hot-Zone ohne ROADMAP zusaetzlich.
 * Reine Doku-, Claim- und Dev-Test-Aenderungen bleiben frei, damit der Ablauf
 * nicht bei jeder Tool-Aenderung bremst.
 */
import { describe, expect, it } from 'vitest';
import { LAST_CHANGES, ROADMAP, driftProblems } from '../../../../scripts/lib/doc-drift.mjs';

describe('Doku-Drift', () => {
  it('blockiert Code ohne Last-Changes-Zeile', () => {
    const problems = driftProblems(['src/core/sim/visitor-record.ts']);
    expect(problems.join('\n')).toContain(LAST_CHANGES);
  });

  it('verlangt fuer Spiel-Hot-Zones zusaetzlich die Roadmap', () => {
    const problems = driftProblems(['src/store/world-store.ts', LAST_CHANGES]);
    expect(problems.join('\n')).toContain(ROADMAP);
  });

  it('laesst reine Doku-, Claim- und Dev-Test-Aenderungen durch', () => {
    expect(driftProblems(['docs/governance/INDEX.md', 'README.md'])).toEqual([]);
    expect(driftProblems(['.lane-claims/claims/lane.json', '.githooks/pre-push'])).toEqual([]);
    expect(driftProblems(['src/core/governance/__tests__/doc-drift.test.ts'])).toEqual([]);
  });

  it('akzeptiert einen vollstaendigen Commit', () => {
    expect(
      driftProblems(['src/render/floor.ts', LAST_CHANGES, ROADMAP, 'src/core/governance/__tests__/x.test.ts']),
    ).toEqual([]);
  });

  it('ignoriert generierte Artefakte als Code-Aenderung', () => {
    expect(driftProblems(['src/core/sim/narrative/composer/registry.generated.ts'])).toEqual([]);
    expect(driftProblems(['content/narrative/registry/fragments.json'])).toEqual([]);
  });
});
