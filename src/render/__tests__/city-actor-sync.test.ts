/**
 * @test-target: src/render/city-actor-sync.ts
 * @error-code: ERR-1002
 *
 * Der Frame-Fortschritt der Stadtbewohner kommt aus dem vorhandenen Tick.
 */
import { describe, expect, it } from 'vitest';
import { actorProgress } from '../city-actor-sync';

describe('CityActorSync · Frame-Fortschritt', () => {
  it('startet am Anfang eines Zugs bei 0', () => {
    expect(actorProgress(1_000, 1_000, 520)).toBe(0);
    expect(actorProgress(1_000, 900, 520)).toBe(0);
  });

  it('liegt zur Tickmitte bei 0.5 und am Ende bei 1', () => {
    expect(actorProgress(1_000, 1_260, 520)).toBeCloseTo(0.5, 6);
    expect(actorProgress(1_000, 1_520, 520)).toBe(1);
    expect(actorProgress(1_000, 9_999, 520)).toBe(1);
  });

  it('faellt bei ungueltigem Tick auf das Ziel zurueck statt zu springen', () => {
    expect(actorProgress(0, 100, 0)).toBe(1);
    expect(actorProgress(0, 100, Number.NaN)).toBe(1);
  });

  it('kappt einen Zeitstempel vor dem Start auf 0', () => {
    expect(actorProgress(Number.NaN, 100, 520)).toBe(0);
  });
});
