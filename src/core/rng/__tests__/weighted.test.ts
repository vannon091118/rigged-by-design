/**
 * @test-target: src/core/rng/weighted.ts
 * @error-code: ERR-1003
 *
 * Die ausgewiesene Chance stammt aus derselben Verteilung, aus der gezogen wird.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../prng';
import { buildDistribution, MAX_BIAS_BPS, pickWeighted, rollNumber } from '../weighted';
import { randomSeed } from '../../../test/random-seed';

const SAMPLE = 8_000;

describe('gewichtetes Ziehen', () => {
  it('weist ohne Bias die Gleichverteilung aus und zieht genau daraus', () => {
    const dist = buildDistribution(1, 6);
    expect(dist.chances).toHaveLength(6);
    for (const chance of dist.chances) expect(chance).toBeCloseTo(1 / 6, 12);
    expect(dist.chances.reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1, 12);
    const prng = new Prng(randomSeed());
    const seen = new Map<number, number>();
    for (let index = 0; index < SAMPLE; index += 1) {
      const roll = rollNumber(prng, dist);
      expect(roll.value).toBe(roll.raw);
      expect(roll.chance).toBe(dist.chances[roll.value - dist.min]);
      seen.set(roll.value, (seen.get(roll.value) ?? 0) + 1);
    }
    expect(seen.size).toBe(6);
    for (const [value, hits] of seen) {
      expect(Math.abs(hits / SAMPLE - dist.chances[value - dist.min]!), `Wert ${value}`).toBeLessThan(0.02);
    }
  });

  it('trifft die angegebene Chance auch mit Bias empirisch', () => {
    const dist = buildDistribution(0, 9, { targets: [3], strengthBps: 3_000 });
    const targetChance = dist.chances[3]!;
    expect(targetChance).toBeGreaterThan(0.3);
    const prng = new Prng(randomSeed());
    let hits = 0;
    for (let index = 0; index < SAMPLE; index += 1) if (rollNumber(prng, dist).value === 3) hits += 1;
    expect(Math.abs(hits / SAMPLE - targetChance)).toBeLessThan(0.02);
  });

  it('haelt Deadzones unerreichbar und laesst den Rohwert im vollen Bereich', () => {
    const dist = buildDistribution(0, 9, { targets: [3], deadzones: [0, 1], strengthBps: 2_000 });
    expect(dist.chances[0]).toBe(0);
    expect(dist.chances[1]).toBe(0);
    const prng = new Prng(randomSeed());
    let sawRawZero = false;
    for (let index = 0; index < 1_000; index += 1) {
      const roll = rollNumber(prng, dist);
      expect(roll.value).toBeGreaterThanOrEqual(2);
      expect(roll.raw).toBeGreaterThanOrEqual(0);
      expect(roll.raw).toBeLessThanOrEqual(9);
      sawRawZero ||= roll.raw === 0;
    }
    expect(sawRawZero).toBe(true);
  });

  it('begrenzt den Bias: kein Wert wird zur sicheren Bank', () => {
    const dist = buildDistribution(0, 1, { targets: [0], strengthBps: MAX_BIAS_BPS });
    expect(dist.chances[0]).toBeLessThan(1);
    // Bei 0..1 mit Ziel 0: Gewicht 1+bonus gegen 1, also exakt 10/11 bei MAX_BIAS_BPS.
    expect(dist.chances[0]).toBeCloseTo((1 + MAX_BIAS_BPS / 1000) / (2 + MAX_BIAS_BPS / 1000), 12);
    expect(() => buildDistribution(0, 9, { targets: [3], strengthBps: MAX_BIAS_BPS + 1 })).toThrow();
    expect(() => buildDistribution(0, 9, { targets: [42], strengthBps: 100 })).toThrow();
    expect(() => buildDistribution(0, 9, { deadzones: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], strengthBps: 100 })).toThrow();
    expect(() => buildDistribution(5, 5, { targets: [5], strengthBps: 100 })).toThrow();
  });

  it('erzeugt fuer denselben Seed dieselbe Folge', () => {
    const dist = buildDistribution(0, 36, { targets: [17], strengthBps: 1_500 });
    const seed = randomSeed();
    const a = new Prng(seed);
    const b = new Prng(seed);
    for (let index = 0; index < 60; index += 1) {
      expect(rollNumber(a, dist)).toEqual(rollNumber(b, dist));
    }
  });
});

describe('gewichtete Auswahl', () => {
  it('waehlt nach Gewicht und ueberspringt abgelehnte Kandidaten', () => {
    const prng = new Prng(randomSeed());
    const entries = [
      { item: 'nie', weight: 0 },
      { item: 'links', weight: 1 },
      { item: 'rechts', weight: 1 },
    ];
    const seen = new Set<string>();
    for (let index = 0; index < 200; index += 1) seen.add(pickWeighted(prng, entries)!);
    expect([...seen].sort()).toEqual(['links', 'rechts']);
    // accept ist ein Filter: was nicht akzeptiert wird, wird uebersprungen.
    const onlyRight = pickWeighted(new Prng(randomSeed()), entries, (item) => item !== 'links');
    expect(onlyRight).toBe('rechts');
    expect(pickWeighted(prng, entries, () => false)).toBeNull();
    expect(pickWeighted(prng, [{ item: 'x', weight: 0 }])).toBeNull();
  });
});
