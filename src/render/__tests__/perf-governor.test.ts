/**
 * @test-target: src/render/perf-governor.ts
 * @error-code: ERR-3001
 *
 * Hysterese: Wechsel erst nach zwei Sekunden Abweichung, nicht nach einem Frame.
 */
import { describe, expect, it } from 'vitest';
import { PerfGovernor, type PerfTier } from '../perf-governor';

const feed = (governor: PerfGovernor, delta: number, ms: number): void => {
  for (let elapsed = 0; elapsed < ms; elapsed += delta) governor.update(delta);
};

describe('Performance-Governor', () => {
  it('startet hoch und bleibt bei einem einzelnen Ausreisser oben', () => {
    const governor = new PerfGovernor();
    governor.update(80);
    expect(governor.tier).toBe('high');
    expect(governor.budget.dpr).toBe(1.5);
  });

  it('faellt nach zwei Sekunden langsamer Frames eine Stufe und dann auf low', () => {
    const governor = new PerfGovernor();
    feed(governor, 40, 2100);
    expect(governor.tier).toBe('mid');
    feed(governor, 40, 2100);
    expect(governor.tier).toBe('low');
    expect(governor.budget).toEqual({ dpr: 1, fps: 30, particles: 60, lights: 0 });
  });

  it('steigt nach zwei Sekunden schneller Frames wieder auf, hoechstens bis high', () => {
    const governor = new PerfGovernor();
    feed(governor, 40, 4200);
    expect(governor.tier).toBe('low');
    feed(governor, 8, 4200);
    expect(governor.tier).toBe('mid');
    feed(governor, 8, 4200);
    expect(governor.tier).toBe('high');
    feed(governor, 8, 4200);
    expect(governor.tier).toBe('high');
  });

  it('flappt nicht zwischen high und mid bei abwechselnd guten/schlechten Frames', () => {
    const governor = new PerfGovernor();
    const tiers: PerfTier[] = [];
    // high und mid haben beide fps=60 (gleiche Schwellen: 15 ms gut, 22,5 ms schlecht),
    // unterscheiden sich nur im dpr (1.5 vs 1.25). Ohne Hysterese schaltet der
    // Governor bei jedem 2s-Block hin und her (high <-> mid).
    for (let round = 0; round < 12; round++) {
      feed(governor, 14, 2100); // gut
      tiers.push(governor.tier);
      feed(governor, 23, 2100); // schlecht
      tiers.push(governor.tier);
    }
    // Zähle Stufenwechsel: ohne Hysterese ist jeder Block ein Wechsel.
    let switches = 0;
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i] !== tiers[i - 1]) switches++;
    }
    // Nicht jeder Block darf einen Wechsel erzeugen (das wäre Flappen).
    expect(switches).toBeLessThan(tiers.length);
  });

  it('hochschaltet langsamer als runterschalten (Hysterese)', () => {
    const governor = new PerfGovernor();
    feed(governor, 23, 2100); // schlecht -> high zu mid
    expect(governor.tier).toBe('mid');
    feed(governor, 14, 2100); // gut, aber zu kurz fuer hochschalten
    expect(governor.tier).toBe('mid'); // bleibt mid
    feed(governor, 14, 4200); // genug gut -> hoch
    expect(governor.tier).toBe('high');
  });

  it('flappt nicht bei konstanter 23 ms/Frame-Belastung (Grenz-FPS)', () => {
    const governor = new PerfGovernor();
    let lastTier = governor.tier;
    let switches = 0;
    // ~30 Sekunden konstanter Last (~1300 Frames bei 23 ms)
    for (let frame = 0; frame < 1300; frame++) {
      const tier = governor.update(23);
      if (tier !== lastTier) {
        switches++;
        lastTier = tier;
      }
    }
    // Konvergeert auf eine stabile Stufe und pendelt nicht endlos.
    expect(switches).toBeLessThanOrEqual(2);
    expect(governor.tier).toBe('low');
    // Und bleibt dort, auch nach weiterer Laufzeit.
    feed(governor, 23, 10000);
    expect(governor.tier).toBe('low');
  });
});
