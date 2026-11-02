/** @test-target: src/core/sim/disputes.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { disputeLevelForTicks } from '../disputes';

describe('Streit-Eskalation ist erreichbar', () => {
  it('bleibt in der ersten Runde', () => {
    expect(disputeLevelForTicks(1)).toBe(1);
  });

  it('erreicht Stufe 2 innerhalb der ANGRY-Dauer von fünf Ticks', () => {
    expect(disputeLevelForTicks(5)).toBe(2);
  });
});
