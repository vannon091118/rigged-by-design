/**
 * Items, Seltenheiten und Paar-Synergien.
 *
 * Bezug: Agent 13 (Items und Roguelite-Synergien). Der Test haelt drei Dinge
 * fest, die leicht auseinanderlaufen: jede Katalog-Id hat genau eine Seltenheit,
 * eine Synergie braucht beide Items und zaehlt nur einmal, und der bestehende
 * Resolver traegt Vorteil und Nachteil - ohne die Auszahlungsquote zu verschieben.
 */
import { describe, expect, it } from 'vitest';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { MODS, getMod, resolveModEffects } from '../offers';
import { ITEM_RARITY, RARITY_ORDER, SYNERGIES, activeSynergies, synergyEffects, synergyOf } from '../item-synergy';
import { itemCollection, itemInventory } from '../item-inventory';
import type { Furniture, ModId, WorldState } from '../types';

const machine = (id: number, mods: ModId[]): Furniture => ({
  id, kind: 'SLOT', gameId: 'SLOT', x: 0, y: 0, w: 1, h: 1, seats: 1, label: `Geraet ${id}`,
  price: 0 as VaCoinMicro, quality: 1, condition: 100, damaged: false, dirt: 0, stock: 0,
  clog: 0, clogged: false, zoneId: 'gaming', occupants: [], mods, reels: 3, baseBet: 0 as VaCoinMicro,
});

const worldWith = (modsList: readonly (readonly ModId[])[]): WorldState =>
  ({ furniture: modsList.map((mods, index) => machine(index + 1, [...mods])) }) as unknown as WorldState;

const ALL_MODS: readonly ModId[] = MODS.map((mod) => mod.id);

describe('Items und Synergien', () => {
  it('gibt jedem Katalog-Item genau eine bekannte Seltenheit', () => {
    for (const mod of MODS) {
      expect(RARITY_ORDER).toContain(ITEM_RARITY[mod.id]);
    }
    expect(Object.keys(ITEM_RARITY).sort()).toEqual([...ALL_MODS].sort());
  });

  it('fuehrt kein Item-Paar doppelt', () => {
    const keys = SYNERGIES.map((entry) => [entry.mods[0], entry.mods[1]].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('aktiviert eine Synergie erst mit beiden Items', () => {
    expect(activeSynergies(['CHERRY'])).toEqual([]);
    expect(activeSynergies(['CHERRY', 'NEAR_MISS']).map((entry) => entry.id)).toEqual(['KOEDER_DOPPEL']);
    expect(synergyOf('NEAR_MISS', 'CHERRY')?.id).toBe('KOEDER_DOPPEL');
    expect(synergyOf('NEON', 'NEAR_MISS')).toBeNull();
  });

  it('zaehlt eine Synergie auch bei doppelter Mod-Id nur einmal', () => {
    expect(synergyEffects(['NEON', 'NEON', 'VELVET'])).toEqual(synergyEffects(['NEON', 'VELVET']));
  });

  it('legt Vorteil und Nachteil auf den vorhandenen Resolver', () => {
    const paired = resolveModEffects('SLOT', ['NEON', 'VELVET']);
    expect(paired.attraction).toBe(getMod('NEON').attraction + getMod('VELVET').attraction + 180);
    expect(paired.operating).toBe(
      getMod('NEON').operating + getMod('VELVET').operating + fromVC(0.02),
    );
    expect(paired.patience).toBe(getMod('NEON').patience + getMod('VELVET').patience);
  });

  it('laesst die Auszahlungsquote der Mods unberuehrt', () => {
    const effects = resolveModEffects('SLOT', ['CHERRY', 'NEAR_MISS']);
    expect(effects.bonusBps).toBe(getMod('CHERRY').bonusBps + getMod('NEAR_MISS').bonusBps);
  });

  it('rechnet eine Synergie nicht, wenn ein Item auf dem Spieltyp nicht gilt', () => {
    expect(resolveModEffects('PLINKO', ['EXTRA_REEL', 'NEON']).attraction).toBe(getMod('NEON').attraction);
    expect(resolveModEffects('PLINKO', ['EXTRA_REEL', 'NEON'])).toEqual(resolveModEffects('PLINKO', ['NEON']));
  });

  it('listet das Inventar ueber alle Maschinen des Hauses', () => {
    const inventory = itemInventory(worldWith([['NEON', 'VELVET'], ['NEON']]));
    const neon = inventory.find((entry) => entry.id === 'NEON');
    const velvet = inventory.find((entry) => entry.id === 'VELVET');
    const cherry = inventory.find((entry) => entry.id === 'CHERRY');
    expect(neon?.machines).toEqual([1, 2]);
    expect(neon?.installed).toBe(true);
    expect(velvet?.machines).toEqual([1]);
    expect(cherry?.machines).toEqual([]);
    expect(cherry?.installed).toBe(false);
  });

  it('zaehlt die Sammlung je Seltenheit und meldet Unvollstaendigkeit', () => {
    const collection = itemCollection(worldWith([['NEON', 'VELVET']]));
    expect([...collection.owned].sort()).toEqual(['NEON', 'VELVET']);
    expect(collection.missing).toHaveLength(ALL_MODS.length - 2);
    expect(collection.byRarity).toEqual({ COMMON: 1, RARE: 1, LEGENDARY: 0 });
    expect(collection.complete).toBe(false);
  });

  it('ist vollstaendig, sobald jedes Item einmal verbaut ist', () => {
    const collection = itemCollection(worldWith([ALL_MODS]));
    expect(collection.missing).toEqual([]);
    expect(collection.complete).toBe(true);
  });
});
