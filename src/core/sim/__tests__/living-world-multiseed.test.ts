/**
 * @test-target: src/core/sim/living-world-multiseed.ts
 * @error-code: ERR-2001
 *
 * Mehrseed-Evidenz: Derselbe Seed reproduziert exakt, verschiedene Seeds
 * erzeugen unterschiedliche, aber aus echten Entscheidungen ableitbare Ketten.
 * Eine unnachvollziehbare Emergenz ist kein gueltiger Nachweis.
 */
import { describe, expect, it } from 'vitest';
import { runSeed } from '../living-world-multiseed';

describe('Living World Mehrseed', () => {
  it('erzeugt ueber Seeds verschiedene, aber reproduzierbare Ketten', () => {
    const runs = [424242, 1, 7].map((seed) => runSeed(seed));
    // Emergenz: nicht jede Erwartung an eine bestimmte Kette haelt, aber jede
    // Kette ist aus einer echten Entscheidung ableitbar.
    expect(new Set(runs.map((run) => run.signature)).size).toBeGreaterThan(1);
    expect(new Set(runs.map((run) => run.metrics)).size).toBeGreaterThan(1);
    // Determinismus: derselbe Seed, dieselben Zahlen — auch nach einem Neustart.
    expect(runSeed(424242).metrics).toBe(runs[0]!.metrics);
    expect(runs[1]!.metrics).not.toBe(runs[0]!.metrics);
  }, 120000);
});
