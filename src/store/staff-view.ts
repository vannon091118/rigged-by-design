/** Personal-Sicht der UI: der Guard besteht, sobald sein Agent existiert. */
import { hasStaff } from '../core/sim/staff-queries';
import type { WorldState } from '../core/sim/types';
import type { StaffView } from './types';

export function staffView(world: WorldState): StaffView {
  return { ...world.staff, guard: hasStaff(world, 'guard') };
}
