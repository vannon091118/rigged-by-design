/**
 * @test-target: scripts/lib/claim-collisions.mjs
 * @error-code: ERR-4019
 *
 * Die Kollisionspruefung entscheidet, welche zwei Lanes parallel arbeiten
 * duerfen. Geteilte, generierte Artefakte (Narrative-Content, Runtime-Registry)
 * regeneriert jede Lane; sie sind deshalb keine Schreibsperre. Echte
 * Quellpfade bleiben es.
 */
import { describe, expect, it } from 'vitest';
import { SHARED_GENERATED_PATHS, findClaimCollisions } from '../../../../scripts/lib/claim-collisions.mjs';

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
});
