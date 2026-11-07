/** @test-target: src/core/sim/traits.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { makeGuest } from '../traits';
import type { PersonaId } from '../types';

function averagePatience(personaId: PersonaId, runs = 40): number {
  const prng = new Prng(randomSeed());
  let sum = 0;
  for (let index = 0; index < runs; index += 1) {
    sum += makeGuest({ id: index + 1, persona: personaId, prng, spawn: { x: 1, y: 1 } }).patience;
  }
  return sum / runs;
}

describe('Persona-Geduld', () => {
  it('startet der Stammgast geduldiger als der High Roller', () => {
    expect(averagePatience('STAMMGAST')).toBeGreaterThan(averagePatience('HIGH_ROLLER'));
  });

  it('bleibt die Geduld im gültigen Bereich', () => {
    expect(averagePatience('LUMPEN', 20)).toBeLessThanOrEqual(100);
  });
});
