/** Der Look des Spielers: reine Darstellung plus kaufbares Kleidungs-/Accessoire-Inventar. */

import type { VaCoinMicro } from '../economy/vacoin';
import { subVC } from '../economy/vacoin';

export type LookAccessory = 'NONE' | 'CAP' | 'GLASSES' | 'CHAIN';

/** Die drei Kopffamilien aus dem Charakter-Atlas; der Editor waehlt eine davon. */
export const LOOK_HEADS = ['head-01', 'head-02', 'head-03'] as const;
export type LookHead = (typeof LOOK_HEADS)[number];

type ClothingCategory = 'TOPS' | 'BOTTOMS' | 'ACCESSORIES' | 'HEAD';

interface ClothingItem {
  readonly id: string;
  readonly name: string;
  readonly category: ClothingCategory;
  readonly brand: string;
  readonly priceVC: number; // VaCoins als Mikro-Einheiten (Integer)
  readonly visual: string; // Hex-Farbe für die visuelle Darstellung
  readonly socialFactor: number; // -1 .. 1, beeinflusst NPC-Wahrnehmung bei Begegnung
}

export interface PlayerLook {
  readonly skin: string;
  readonly hair: string;
  readonly head: LookHead;
  readonly outfit: string;
  readonly accessory: LookAccessory;
  readonly wardrobe: readonly string[]; // Beschaffte Item-IDs
  readonly equippedItemId: string | null; // Aktuell getragenes Item
}

export const LOOK_SKINS = ['#f2d3b3', '#e0b48c', '#b97c4b', '#8a5a36', '#d8a27a'] as const;
export const LOOK_HAIRS = ['#2a1a14', '#5a3a22', '#d9b35c', '#1a1020', '#9a5a2a'] as const;
export const LOOK_OUTFITS = ['#00ffcc', '#ff2e88', '#ffd166', '#b06bff', '#00c9a7'] as const;
export const LOOK_ACCESSORIES: readonly { id: LookAccessory; name: string }[] = [
  { id: 'NONE', name: 'Ohne' },
  { id: 'CAP', name: 'Cap' },
  { id: 'GLASSES', name: 'Brille' },
  { id: 'CHAIN', name: 'Kette' },
];

/** Kaufbares Kleidungs- und Accessoire-Inventar. Preise in Mikro-VaCoins (Integer). */
const LOOK_ITEMS: readonly ClothingItem[] = Object.freeze([
  { id: 'tee_street', name: 'Street-Tee', category: 'TOPS', brand: 'UrbanThreads', priceVC: 500, visual: '#ff2e88', socialFactor: 0.10 },
  { id: 'cap_basic', name: 'Basis-Cap', category: 'HEAD', brand: 'CapCo', priceVC: 300, visual: '#000000', socialFactor: 0.05 },
  { id: 'chain_silver', name: 'Silberkette', category: 'ACCESSORIES', brand: 'BlingHouse', priceVC: 800, visual: '#ffd166', socialFactor: 0.15 },
  { id: 'dress_evening', name: 'Abendkleid', category: 'TOPS', brand: 'Nachtrag', priceVC: 1200, visual: '#b06bff', socialFactor: 0.20 },
]);

export function findClothingItem(itemId: string): ClothingItem | undefined {
  return LOOK_ITEMS.find((item) => item.id === itemId);
}

function canAfford(balance: VaCoinMicro, itemId: string): { ok: boolean; item?: ClothingItem; shortfall?: VaCoinMicro } {
  const item = findClothingItem(itemId);
  if (!item) return { ok: false };
  if (balance >= (item.priceVC as VaCoinMicro)) return { ok: true, item };
  return { ok: false, item, shortfall: subVC(item.priceVC as VaCoinMicro, balance) };
}

export function buyItem(balance: VaCoinMicro, itemId: string): { ok: boolean; remaining: VaCoinMicro; item?: ClothingItem; error?: string } {
  const check = canAfford(balance, itemId);
  if (!check.ok) {
    return { ok: false, remaining: balance, error: check.shortfall ? 'Nicht genug Geld.' : 'Kleidungsstück nicht im Katalog.' };
  }
  return { ok: true, remaining: subVC(balance, check.item!.priceVC as VaCoinMicro), item: check.item };
}

export const DEFAULT_LOOK: PlayerLook = {
  skin: LOOK_SKINS[0],
  hair: LOOK_HAIRS[0],
  head: LOOK_HEADS[0],
  outfit: LOOK_OUTFITS[0],
  accessory: 'NONE',
  wardrobe: [],
  equippedItemId: null,
};

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

/** Alte Saves und kaputte Eingaben fallen auf den Default zurueck. */
export function normalizeLook(raw: unknown): PlayerLook {
  if (!raw || typeof raw !== 'object') return DEFAULT_LOOK;
  const value = raw as Partial<PlayerLook>;
  const accessory = LOOK_ACCESSORIES.some((entry) => entry.id === value.accessory)
    ? value.accessory as LookAccessory
    : DEFAULT_LOOK.accessory;
  const head = (LOOK_HEADS as readonly unknown[]).includes(value.head)
    ? value.head as LookHead
    : DEFAULT_LOOK.head;
  return {
    skin: isHex(value.skin) ? value.skin : DEFAULT_LOOK.skin,
    hair: isHex(value.hair) ? value.hair : DEFAULT_LOOK.hair,
    head,
    outfit: isHex(value.outfit) ? value.outfit : DEFAULT_LOOK.outfit,
    accessory,
    wardrobe: Array.isArray(value.wardrobe) && value.wardrobe.every((id) => typeof id === 'string')
      ? [...value.wardrobe]
      : DEFAULT_LOOK.wardrobe,
    equippedItemId: typeof value.equippedItemId === 'string' || value.equippedItemId === null
      ? value.equippedItemId
      : DEFAULT_LOOK.equippedItemId,
  };
}

/** Nur echte Optionen sind erlaubt; die UI kann keinen freien Hex-Wert einschmuggeln. */
export function applyLook(current: PlayerLook, patch: Partial<PlayerLook>): PlayerLook {
  const next = normalizeLook({ ...current, ...patch });
  const validWardrobe = next.wardrobe.filter((id) => LOOK_ITEMS.some((item) => item.id === id));
  const validEquipped = next.equippedItemId !== null && validWardrobe.includes(next.equippedItemId)
    ? next.equippedItemId
    : null;
  return {
    ...next,
    wardrobe: validWardrobe,
    equippedItemId: validEquipped,
    skin: (LOOK_SKINS as readonly string[]).includes(next.skin) ? next.skin : current.skin,
    hair: (LOOK_HAIRS as readonly string[]).includes(next.hair) ? next.hair : current.hair,
    head: (LOOK_HEADS as readonly unknown[]).includes(patch.head) ? patch.head as LookHead : current.head,
    outfit: (LOOK_OUTFITS as readonly string[]).includes(next.outfit) ? next.outfit : current.outfit,
  };
}
