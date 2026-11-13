/**
 * @test-target: src/core/sim/needs-core.ts
 * @error-code: ERR-2001
 */
import { describe, expect, it } from 'vitest';
import { clampNeed, clampNeedValue, driftNeed, needAtLeast, needAtMost, satisfyNeed } from '../needs-core';

describe('Gemeinsamer Needs-Kern', () => {
  it('klemmt Werte auf 0..100 und rundet nur die gespeicherte Form', () => {
    expect(clampNeedValue(-1)).toBe(0);
    expect(clampNeedValue(101)).toBe(100);
    expect(clampNeed(41.6)).toBe(42);
    expect(clampNeed(-0.1)).toBe(0);
  });

  it('hält Drift und Sättigung an denselben Grenzen', () => {
    expect(driftNeed(95, 10)).toBe(100);
    expect(driftNeed(0, 0)).toBe(0);
    expect(satisfyNeed(5, 10)).toBe(0);
    expect(satisfyNeed(100, 0)).toBe(100);
  });

  it('addiert und subtrahiert mehrere Raten in der übergebenen Reihenfolge', () => {
    // 0.1 + 0.2 + 0.3 ist linksassoziativ 0.6000000000000001,
    // 0.1 + (0.2 + 0.3) dagegen 0.6. Der Kern darf die Reihenfolge nicht ändern.
    expect(driftNeed(0.1, 0.2, 0.3)).toBe(0.1 + 0.2 + 0.3);
    expect(satisfyNeed(1, 0.1, 0.2)).toBe(1 - 0.1 - 0.2);
  });

  it('prüft Schwellen in beide Richtungen', () => {
    expect(needAtLeast(60, 60)).toBe(true);
    expect(needAtLeast(59.9, 60)).toBe(false);
    expect(needAtMost(5, 5)).toBe(true);
    expect(needAtMost(5.1, 5)).toBe(false);
  });
});
