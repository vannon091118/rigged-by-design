/**
 * @test-target: src/render/perf-governor.ts
 * @error-code: ERR-3001
 *
 * Hysterese: Wechsel erst nach zwei Sekunden Abweichung, nicht nach einem Frame.
 */
import { describe, expect, it } from 'vitest';
import { PerfGovernor } from '../perf-governor';

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
    feed(governor, 8, 2100);
    expect(governor.tier).toBe('mid');
    feed(governor, 8, 2100);
    expect(governor.tier).toBe('high');
    feed(governor, 8, 2100);
    expect(governor.tier).toBe('high');
  });
});
