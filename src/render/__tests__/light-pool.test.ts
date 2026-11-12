/** @test-target: src/render/light-pool.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { LIGHT_POOL_SLOTS, lightSlots } from '../light-pool';

function viewWithZones(count: number) {
  const zones = Array.from({ length: count }, (_, index) => ({
    id: `z${index}`, name: `Zone ${index}`, kind: 'GAMING' as const,
    x: index, y: index, w: 2, h: 2, color: 1,
  }));
  return {
    size: 30, template: 'MEDIUM' as const, carpet: 'VIOLET' as const, zones, furniture: [],
    dirtyTiles: new Set<number>(), layout: createWorld('MEDIUM').layout, dayPhase: 'evening' as const,
  } as never;
}

describe('Lichtpool', () => {
  it('belegt hoechstens 16 Slots und bleibt deterministisch', () => {
    const view = viewWithZones(20);
    const first = lightSlots(view);
    const second = lightSlots(view);
    expect(first).toHaveLength(LIGHT_POOL_SLOTS);
    expect(first).toEqual(second);
    expect(first[0]!.x).toBe((0 + 2 / 2) * TILE);
    expect(first[0]!.y).toBe((0 + 2 / 2) * TILE);
  });
});
