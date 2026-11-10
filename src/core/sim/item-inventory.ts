/**
 * Inventar und Sammlung: eine abgeleitete Sicht auf den vorhandenen Zustand.
 *
 * Der Besitz ist keine zweite Liste im Save, sondern genau das, was auf den
 * Maschinen des Hauses verbaut ist (`item.mods`, seit v11 gespeichert). Damit
 * gibt es keinen zweiten Zaehler und keine Migration: was die Simulation liest,
 * ist dasselbe, was hier als Sammlung erscheint.
 */
import { MODS } from './offers';
import { ITEM_RARITY, RARITY_ORDER, type ItemRarity } from './item-synergy';
import type { ModId, WorldState } from './types';

export interface ItemStock {
  readonly id: ModId;
  readonly rarity: ItemRarity;
  /** Maschinen-Ids, auf denen das Item verbaut ist. */
  readonly machines: readonly number[];
  readonly installed: boolean;
}

/** Ein Eintrag je Katalog-Item, auch fuer noch nicht verbaute Items. */
export function itemInventory(world: WorldState): readonly ItemStock[] {
  return MODS.map((mod) => {
    const machines = world.furniture
      .filter((item) => item.mods.includes(mod.id))
      .map((item) => item.id);
    return { id: mod.id, rarity: ITEM_RARITY[mod.id], machines, installed: machines.length > 0 };
  });
}

export interface ItemCollection {
  readonly owned: readonly ModId[];
  readonly missing: readonly ModId[];
  readonly byRarity: Record<ItemRarity, number>;
  readonly complete: boolean;
}

/** Sammlung aus dem Inventar: besessen, fehlend und je Seltenheit gezaehlt. */
export function itemCollection(world: WorldState): ItemCollection {
  const stock = itemInventory(world);
  const owned = stock.filter((entry) => entry.installed).map((entry) => entry.id);
  const missing = stock.filter((entry) => !entry.installed).map((entry) => entry.id);
  const byRarity = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, 0])) as Record<ItemRarity, number>;
  for (const entry of stock) {
    if (entry.installed) byRarity[entry.rarity] += 1;
  }
  return { owned, missing, byRarity, complete: missing.length === 0 };
}
