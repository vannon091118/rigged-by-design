/**
 * @test-target: src/store/migrate.ts
 * @error-code: ERR-1002
 *
 * Alte Speicherstaende koennen eine Geräteidentität tragen, die zum Spieltyp
 * des Katalogs widerspricht. Das Laden heilt sie, bevor Fussabdruck, Lager
 * und Walzen daraus abgeleitet werden; unbekannte Spieltypen verschwinden.
 */
import { describe, expect, it } from 'vitest';
import type { VaCoinMicro } from '../../core/economy/vacoin';
import type { Furniture } from '../../core/sim/types';
import { replaySave } from '../save';

const SLOT: Furniture = {
  id: 510, kind: 'SLOT', gameId: 'SLOT', x: 4, y: 4, w: 1, h: 1, seats: 1,
  label: 'Altgerät', price: 0 as VaCoinMicro, quality: 1, condition: 80, damaged: false, dirt: 0,
  stock: 0, clog: 0, clogged: false, zoneId: 'gaming', occupants: [], mods: [],
  reels: 3, baseBet: 0 as VaCoinMicro,
};

function oldSave(overrides: Record<string, unknown> = {}) {
  return {
    version: 5,
    template: 'SMALL',
    carpet: 'VIOLET',
    furniture: [SLOT],
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

describe('Migration der Geräteidentität', () => {
  it('stellt die Katalogidentität her, bevor Fussabdruck und Lager fallen', () => {
    const loaded = replaySave(oldSave({
      furniture: [{ ...SLOT, id: 511, kind: 'BAR', gameId: 'PLINKO', stock: undefined }],
    }));
    expect(loaded).not.toBeNull();

    const device = loaded!.world.furniture.find((item) => item.id === 511)!;
    expect(device.kind).toBe('SLOT');
    expect(device.gameId).toBe('PLINKO');
    expect(device.stock).toBe(0);
  });

  it('entfernt einen Spieltyp ohne Katalogeintrag und behält das Gerät', () => {
    const loaded = replaySave(oldSave({
      furniture: [{ ...SLOT, id: 512, gameId: 'VULKAN' }],
    }));
    expect(loaded).not.toBeNull();

    const device = loaded!.world.furniture.find((item) => item.id === 512)!;
    expect(device.gameId).toBeUndefined();
    expect(device.kind).toBe('SLOT');
    expect(device.reels).toBe(3);
  });
});
