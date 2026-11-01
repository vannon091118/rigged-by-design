/**
 * @test-target: src/core/rng/streams.ts
 * @error-code: ERR-1003
 *
 * Gameplay- und Darstellungsstrom teilen keinen Zustand: Effekte duerfen den
 * naechsten Gegnerspawn nicht verschieben.
 */
import { describe, expect, it } from 'vitest';
import { playRound } from '../../games/round';
import { Prng } from '../prng';
import { assertGameplayRng, presentationRng, presentationSeed } from '../streams';
import { randomSeed } from '../../../test/random-seed';

describe('RNG-Namespaces', () => {
  it('zieht aus dem Darstellungsstrom, ohne den Spielstrom zu bewegen', () => {
    const seed = randomSeed();
    const gameplay = new Prng(seed);
    const presentation = presentationRng(seed);
    const before = gameplay.getState();
    for (let index = 0; index < 50; index += 1) presentation.nextFloat();
    expect(gameplay.getState()).toBe(before);
    expect(gameplay.nextUint32()).toBe(new Prng(seed).nextUint32());
  });

  it('markiert beide Rollen und weist Darstellung an der Core-Grenze ab', () => {
    const gameplay = new Prng(randomSeed());
    const presentation = presentationRng(randomSeed());
    expect(gameplay.role).toBe('gameplay');
    expect(presentation.role).toBe('presentation');
    expect(assertGameplayRng(gameplay)).toBe(gameplay);
    expect(() => assertGameplayRng(presentation)).toThrow(/presentation/);
  });

  it('laesst einen Darstellungsstrom kein Spiel bewegen', () => {
    expect(() => playRound('SLOT', presentationRng(randomSeed()))).toThrow(/presentation/);
  });

  it('erzeugt einen uint32-Darstellungs-Seed', () => {
    for (let index = 0; index < 20; index += 1) {
      const seed = presentationSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(0x1_0000_0000);
    }
  });
});
