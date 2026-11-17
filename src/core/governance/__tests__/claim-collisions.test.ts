/**
 * @test-target: scripts/lib/claim-collisions.mjs
 * @error-code: ERR-4019
 *
 * Die Kollisionspruefung entscheidet, welche zwei Lanes parallel arbeiten
 * duerfen. Geteilte, generierte Artefakte (Narrative-Content, Runtime-Registry,
 * die Doku-Dateien aus `docs/CI.md`) regeneriert jede Lane; sie sind deshalb
 * keine Schreibsperre. Echte Quell- und handgepflegte Dokumentpfade bleiben es.
 */
import { describe, expect, it } from 'vitest';
import { SHARED_GENERATED_PATHS, findClaimCollisions } from '../../../../scripts/lib/claim-collisions.mjs';
import { MECHANICAL_FILES, META_FILES } from '../../../../scripts/lib/lane-claims.mjs';

const claim = (patch = {}) => ({
  id: 'lane/feature/demo',
  branch: 'lane/feature/demo',
  pathAllowlist: ['src/core/**'],
  ...patch,
});

describe('claim-collisions', () => {
  it('laesst geteilte generierte Pfade keine Kollision sein', () => {
    const shared = [...SHARED_GENERATED_PATHS];
    const a = claim({ id: 'lane/a/demo', pathAllowlist: shared });
    const b = claim({ id: 'lane/b/demo', branch: 'lane/b/demo', pathAllowlist: shared });
    expect(findClaimCollisions({ newClaim: a, candidates: [b] })).toEqual([]);
  });

  it('blockiert einen echten Quellpfad-Overlap weiterhin', () => {
    const shared = [...SHARED_GENERATED_PATHS, 'src/core/physics/body.ts'];
    const a = claim({ id: 'lane/a/demo', pathAllowlist: shared });
    const b = claim({ id: 'lane/b/demo', branch: 'lane/b/demo', pathAllowlist: shared });
    const collisions = findClaimCollisions({ newClaim: a, candidates: [b] });
    expect(collisions).toHaveLength(1);
    expect(collisions[0].reason).toContain('Überschneidung');
  });

  // #897: die Doku-Artefakte aus der Eigentuemerliste in `docs/CI.md` sind
  // generiert und deshalb mechanisch. Fehlt eines in MECHANICAL_FILES, blockiert
  // der Pre-Push-Hook jede Lane, die es teilt.
  it('fuehrt die generierten Doku-Artefakte aus docs/CI.md als mechanisch', () => {
    expect(MECHANICAL_FILES).toEqual(
      expect.arrayContaining(['docs/INVENTORY.md', 'docs/governance/ROADMAP.md', 'docs/DEPENDENCY-MATRIX.md']),
    );
  });

  it('laesst eine Lane ohne Kollision, die nur die generierte Dependency-Matrix teilt', () => {
    const path = 'docs/DEPENDENCY-MATRIX.md';
    const a = claim({ id: 'lane/a/demo', pathAllowlist: [path] });
    const b = claim({ id: 'lane/b/demo', branch: 'lane/b/demo', pathAllowlist: [path] });
    expect(
      findClaimCollisions({
        newClaim: a,
        candidates: [b],
        metaFiles: META_FILES,
        mechanicalFiles: MECHANICAL_FILES,
      }),
    ).toEqual([]);
  });

  it('blockiert einen handgepflegten Doku-Overlap weiterhin', () => {
    for (const path of ['docs/GOVERNANCE.md', 'docs/TESTING.md', 'docs/FLAG.md']) {
      expect(MECHANICAL_FILES).not.toContain(path);
      const a = claim({ id: 'lane/a/demo', pathAllowlist: [path] });
      const b = claim({ id: 'lane/b/demo', branch: 'lane/b/demo', pathAllowlist: [path] });
      const collisions = findClaimCollisions({
        newClaim: a,
        candidates: [b],
        metaFiles: META_FILES,
        mechanicalFiles: MECHANICAL_FILES,
      });
      expect(collisions, path).toHaveLength(1);
    }
  });
});
