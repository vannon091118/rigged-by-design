/**
 * @test-target: src/store/migrate.ts
 * @error-code: ERR-1002
 *
 * Alte Speicherstaende koennen eine ungueltige Walzenzahl tragen. Das Laden
 * heilt sie auf den spielbaren Rahmen, Tische behalten ihre Null.
 */
import { describe, expect, it } from 'vitest';
import type { VaCoinMicro } from '../../core/economy/vacoin';
import { slotConfigOf, MAX_REELS, MIN_REELS } from '../../core/games/slot-config';
import type { Furniture } from '../../core/sim/types';
import { replaySave } from '../save';

const SLOT: Furniture = {
  id: 501, kind: 'SLOT', gameId: 'SLOT', x: 4, y: 4, w: 1, h: 1, seats: 1,
  label: 'Altgerät', price: 0 as VaCoinMicro, quality: 1, condition: 80, damaged: false, dirt: 0,
  stock: 0, clog: 0, clogged: false, zoneId: 'gaming', occupants: [], mods: [],
  reels: 9, baseBet: 0 as VaCoinMicro,
};

function oldSave(overrides: Record<string, unknown> = {}) {
  return {
    version: 5,
    template: 'SMALL',
    carpet: 'VIOLET',
    furniture: [SLOT, { ...SLOT, id: 502, kind: 'TABLE', gameId: 'ROULETTE', label: 'Tisch', reels: 0 }],
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

describe('Migration der Walzenzahl', () => {
  it('heilt eine ungueltige Walzenzahl beim Laden auf den spielbaren Rahmen', () => {
    const loaded = replaySave(oldSave());
    expect(loaded).not.toBeNull();

    const slot = loaded!.world.furniture.find((item) => item.id === 501)!;
    const table = loaded!.world.furniture.find((item) => item.id === 502)!;

    expect(slot.reels).toBe(MAX_REELS);
    expect(table.reels).toBe(0);
    expect(() => slotConfigOf(slot)).not.toThrow();
    expect(slotConfigOf(slot).reels).toBe(MAX_REELS);
  });

  it('setzt einen fehlenden Wert auf die Mindestwalzenzahl', () => {
    const loaded = replaySave(oldSave({ furniture: [{ ...SLOT, reels: undefined }] }));
    expect(loaded!.world.furniture.find((item) => item.id === 501)!.reels).toBe(MIN_REELS);
  });
});
