/** @test-target: src/store/staff-view.ts | @error-code: ERR-1002 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../core/sim/templates';
import { hasStaff } from '../../core/sim/staff-queries';
import { staffView } from '../staff-view';

describe('staffView', () => {
  it('uebernimmt den Personalbestand und meldet den Guard nur, wenn sein Agent existiert', () => {
    const world = createWorld('SMALL');
    const view = staffView(world);

    expect(view).toEqual({ ...world.staff, guard: hasStaff(world, 'guard') });
    expect(view.guard).toBe(false);
  });
});
