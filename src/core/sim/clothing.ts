/**
 * Kleidung, Marken und Accessoires: Inventar mit Preis, Kategorie und einem
 * begrenzten sozialen Faktor.
 *
 * Farben bleiben reine Darstellung (`player-look.ts`). Gekauft wird ausschliess-
 * lich ueber den Ledger aus dem Portemonnaie, getragen wird je ein Outfit und
 * ein Accessoire im bestehenden `world.player`-Zustand. Der soziale Faktor ist
 * klein und gedeckelt: er verschiebt die Ansprechchance, er ersetzt sie nicht.
 */
import type { Ledger } from '../economy/ledger';
import { fromVC } from '../economy/vacoin';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { TX_REASON } from './tx-reasons';
import type { WorldState } from './types';

type ClothingCategory = 'OUTFIT' | 'ACCESSORY';
export type ClothingId = 'JACKE_BASIC' | 'JACKE_DESIGNER' | 'CAP_LOGO' | 'KETTE_GOLD' | 'BRILLE_MARKE';

interface ClothingItem {
  readonly id: ClothingId;
  readonly label: string;
  readonly brand: string;
  readonly category: ClothingCategory;
  readonly priceVC: number;
  /** Sichtbares Auftreten 0..3; die Summe beider Slots ist bei 10 gedeckelt. */
  readonly style: number;
  readonly note: string;
}

export interface ClothingState {
  owned: ClothingId[];
  wornOutfit: ClothingId | null;
  wornAccessory: ClothingId | null;
}

interface ClothingViewItem extends Omit<ClothingItem, 'style'> {
  readonly style: number;
  readonly owned: boolean;
  readonly worn: boolean;
}

export interface ClothingView {
  readonly items: readonly ClothingViewItem[];
  /** Ansprechchance-Punkte aus dem getragenen Auftreten (0..10). */
  readonly bonus: number;
  readonly hint: string;
}

const CLOTHING_ITEMS: readonly ClothingItem[] = [
  { id: 'JACKE_BASIC', label: 'Einfache Jacke', brand: 'Ohne Marke', category: 'OUTFIT', priceVC: 120, style: 0,
    note: 'Sauber, unauffaellig, kein Gespraechsthema.' },
  { id: 'JACKE_DESIGNER', label: 'Designerjacke', brand: 'Vannon', category: 'OUTFIT', priceVC: 900, style: 3,
    note: 'Man sieht den Schnitt, bevor man den Preis ahnt.' },
  { id: 'CAP_LOGO', label: 'Kappe mit Logo', brand: 'KIEZ', category: 'ACCESSORY', priceVC: 180, style: 1,
    note: 'Ein lokales Logo; die halbe Strasse erkennt es.' },
  { id: 'KETTE_GOLD', label: 'Goldkette', brand: 'Kette', category: 'ACCESSORY', priceVC: 450, style: 2,
    note: 'Traegt auf, wenn das Licht stimmt.' },
  { id: 'BRILLE_MARKE', label: 'Markenbrille', brand: 'Optik 24', category: 'ACCESSORY', priceVC: 320, style: 2,
    note: 'Gepflegter Rahmen, ruhiger Blick.' },
];

const EMPTY_CLOTHING: ClothingState = { owned: [], wornOutfit: null, wornAccessory: null };

function clothingItem(id: string): ClothingItem | null {
  return CLOTHING_ITEMS.find((item) => item.id === id) ?? null;
}

/** Alte Saves und kaputte Eingaben: nur bekannte IDs, nur Getragenes im Besitz. */
export function normalizeClothing(raw: unknown): ClothingState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_CLOTHING, owned: [] };
  const value = raw as Partial<ClothingState>;
  const owned = [...new Set((Array.isArray(value.owned) ? value.owned : [])
    .filter((id): id is ClothingId => clothingItem(id) !== null))];
  const worn = (id: unknown, category: ClothingCategory): ClothingId | null => {
    const item = typeof id === 'string' ? clothingItem(id) : null;
    return item !== null && item.category === category && owned.includes(item.id) ? item.id : null;
  };
  return { owned, wornOutfit: worn(value.wornOutfit, 'OUTFIT'), wornAccessory: worn(value.wornAccessory, 'ACCESSORY') };
}

/** Auftreten als begrenzter Faktor: Outfit plus Accessoire, nie mehr als 10. */
export function styleBonus(world: WorldState): number {
  const worn = [world.player.clothing.wornOutfit, world.player.clothing.wornAccessory]
    .map((id) => (id === null ? 0 : clothingItem(id)?.style ?? 0));
  return Math.min(10, worn.reduce((sum, style) => sum + style * 2, 0));
}

export function clothingView(world: WorldState): ClothingView {
  const state = world.player.clothing;
  const bonus = styleBonus(world);
  return {
    items: CLOTHING_ITEMS.map((item) => ({
      ...item,
      owned: state.owned.includes(item.id),
      worn: state.wornOutfit === item.id || state.wornAccessory === item.id,
    })),
    bonus,
    hint: bonus === 0
      ? 'Dein Auftreten ist neutral: niemand reagiert auf die Kleidung.'
      : `Dein Auftreten wirkt: +${bonus} Punkte auf die Ansprechchance, nicht auf die Laune.`,
  };
}

/** Kauf aus dem Portemonnaie; ein Item gehoert danach dir und kann getragen werden. */
export function buyClothing(world: WorldState, ledger: Ledger, id: string, tick: number): string {
  const item = clothingItem(id);
  if (!item) throw new Error(`Unbekanntes Kleidungsstueck: ${id}.`);
  if (world.player.clothing.owned.includes(item.id)) throw new Error(`Du besitzt ${item.label} bereits.`);
  const cost = fromVC(item.priceVC);
  if (ledger.getBalance(PORTEMONNAIE) < cost) {
    throw new Error(`Nicht genug Bargeld. Benoetigt: ${item.priceVC} VC fuer ${item.label}.`);
  }
  ledger.transfer(PORTEMONNAIE, EXTERNAL, cost, TX_REASON.CLOTHING, tick);
  world.player.clothing.owned.push(item.id);
  const notice = `${item.label} (${item.brand}) fuer ${item.priceVC} VC gekauft.`;
  world.lastEvent = notice;
  recordJournal(world, { kind: 'SYSTEM', subject: 'KLEIDUNG', cause: 'Kauf', effect: notice, refs: {} });
  return notice;
}

/** Tragen und Ablegen; nur eigene Stuecke, je Kategorie ein Slot. */
export function wearClothing(world: WorldState, id: string): string {
  const item = clothingItem(id);
  if (!item) throw new Error(`Unbekanntes Kleidungsstueck: ${id}.`);
  const state = world.player.clothing;
  if (!state.owned.includes(item.id)) throw new Error(`${item.label} besitzt du nicht.`);
  const slot = item.category === 'OUTFIT' ? 'wornOutfit' : 'wornAccessory';
  const active = state[slot] === item.id;
  state[slot] = active ? null : item.id;
  const notice = active ? `${item.label} abgelegt.` : `${item.label} angezogen.`;
  world.lastEvent = notice;
  return notice;
}
