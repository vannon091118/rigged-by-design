/**
 * @test-target: src/store/migrate.ts
 * @error-code: ERR-1002
 *
 * Alte Speicherstaende trugen den Guard als Flag neben den Agenten. Beim Laden
 * gilt der Agentenbestand: das Flag wird gelesen, aber nie uebernommen, und ein
 * fehlender Agent wird nachgetragen, statt die Einstellung still zu verlieren.
 */
import { describe, expect, it } from 'vitest';
import { hasStaff } from '../../core/sim/staff-queries';
import type { StaffAgent } from '../../core/sim/types';
import { replaySave } from '../save';

const GUARD: StaffAgent = {
  id: 700, role: 'guard', x: 5, y: 5, path: [], pathIndex: 0, carryingCrate: null,
  workTicks: 0, task: 'patrol', blockedReason: '', targetDisputeId: null,
};

function oldSave(overrides: Record<string, unknown> = {}) {
  return {
    version: 5,
    template: 'SMALL',
    carpet: 'VIOLET',
    furniture: [],
    guests: [],
    player: { position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '' },
    dirty: [],
    prices: {
      entryFee: 0, drinkPrice: 4000, slotMinBet: 500, staffWage: 40000,
      guardWage: 60000, cleaningCost: 8000, repairCost: 20000,
    },
    staff: { guard: false, cleaner: false, bartender: false },
    tick: 3,
    day: 1,
    nextGuestId: 1,
    nextFurnitureId: 900,
    guardsHired: 0,
    lastEvent: 'alter Stand',
    entries: [],
    prngState: 4242,
    ...overrides,
  };
}

describe('Migration des Personalstands', () => {
  it('trägt einen nur als Flag geführten Guard als Agenten nach', () => {
    const loaded = replaySave(oldSave({
      staff: { guard: true, cleaner: false, bartender: false },
      guardsHired: 1,
    }));
    expect(loaded).not.toBeNull();

    const world = loaded!.world;
    const guards = world.agents.filter((agent) => agent.role === 'guard');
    expect(guards).toHaveLength(1);
    expect(guards[0]!.blockedReason).toBe('');
    expect(guards[0]!.task).toBe('patrol');
    expect(hasStaff(world, 'guard')).toBe(true);
    expect(world.guardsHired).toBeGreaterThanOrEqual(1);
    expect(Object.keys(world.staff).sort()).toEqual(['bartender', 'cashier', 'cleaner', 'porter']);
  });

  it('behält einen vorhandenen Agenten, auch wenn das alte Flag fehlt', () => {
    const loaded = replaySave(oldSave({
      agents: [GUARD],
      nextAgentId: 701,
      staff: { guard: false, cleaner: false, bartender: false },
    }));
    expect(loaded).not.toBeNull();

    const world = loaded!.world;
    expect(world.agents).toHaveLength(1);
    expect(world.agents[0]!.role).toBe('guard');
    expect(hasStaff(world, 'guard')).toBe(true);
    expect(Object.keys(world.staff).sort()).toEqual(['bartender', 'cashier', 'cleaner', 'porter']);
  });
});
