/**
 * Stabile Renderrollen für Möbel und Deko.
 *
 * Die Reihenfolge ist verbindlich: `gameId`, `kind`, explizite Asset-ID,
 * erst danach ein exakt bekannter Anzeigename. Ein unbekannter Name ist keine
 * Rolle und wird als unaufgelöste Fläche gezeichnet; es gibt keinen Regex-Fallback.
 */
import type { GameId, Furniture } from '../core/sim/types';

export type FurnitureRole =
  | 'SLOT' | 'BLACKJACK' | 'POKER' | 'VIDEO_POKER' | 'ROULETTE' | 'PLINKO' | 'SHELL' | 'DICE'
  | 'BAR' | 'TOILET' | 'EXCHANGE' | 'STORAGE'
  | 'SOFA' | 'ARMCHAIR' | 'PALM' | 'PLANT' | 'NEON' | 'COLUMN' | 'CHANDELIER'
  | 'CANDELABRA' | 'STATUE' | 'ROPE' | 'LAMP' | 'NEWSPAPER' | 'SIDE_TABLE'
  | 'COUNTER' | 'SIGN' | 'MIRROR' | 'BED' | 'WARDROBE' | 'TABLE' | 'KITCHEN'
  | 'FRIDGE' | 'SINK' | 'SMARTPHONE';

interface FurnitureRoleResolution {
  readonly role: FurnitureRole;
  /** Manifest-Pfad relativ zum Asset-Base; `null` heißt: prozedural zeichnen. */
  readonly asset: string | null;
  /** Stabiler Schlüssel für Atlas und Tests. */
  readonly key: string;
}

const GAME_ROLES: Readonly<Record<GameId, FurnitureRoleResolution>> = {
  SLOT: { role: 'SLOT', asset: 'machines/slot-cabinet.png', key: 'game:SLOT' },
  BLACKJACK: { role: 'BLACKJACK', asset: 'machines/blackjack-table.png', key: 'game:BLACKJACK' },
  POKER: { role: 'POKER', asset: 'machines/poker-table.png', key: 'game:POKER' },
  VIDEO_POKER: { role: 'VIDEO_POKER', asset: 'machines/video-poker-terminal.png', key: 'game:VIDEO_POKER' },
  ROULETTE: { role: 'ROULETTE', asset: 'machines/roulette-table.png', key: 'game:ROULETTE' },
  PLINKO: { role: 'PLINKO', asset: 'machines/plinko-cabinet.png', key: 'game:PLINKO' },
  SHELL: { role: 'SHELL', asset: 'machines/table-games/shell-game-cups-and-pearl.png', key: 'game:SHELL' },
  DICE: { role: 'DICE', asset: 'machines/dice-table.png', key: 'game:DICE' },
};

const KIND_ROLES: Readonly<Record<string, FurnitureRoleResolution>> = {
  BAR: { role: 'BAR', asset: 'decor/bar-back-shelf.png', key: 'kind:BAR' },
  TOILET: { role: 'TOILET', asset: 'machines/restroom-stall.png', key: 'kind:TOILET' },
  EXCHANGE: { role: 'EXCHANGE', asset: 'machines/cashier-counter.png', key: 'kind:EXCHANGE' },
  STORAGE: { role: 'STORAGE', asset: 'machines/storage-shelves.png', key: 'kind:STORAGE' },
};

/**
 * Wohnungsmoebel ueber ihre stabile Kunst-ID: eigene Rolle, kein Casino-Asset.
 * Die Kennung bleibt gueltig, wenn ein Anzeigename umformuliert wird.
 */
const ART_ROLES: Readonly<Record<string, FurnitureRoleResolution>> = {
  'apartment:bed': { role: 'BED', asset: null, key: 'apt:BED' },
  'apartment:wardrobe': { role: 'WARDROBE', asset: null, key: 'apt:WARDROBE' },
  'apartment:sofa': { role: 'SOFA', asset: null, key: 'apt:SOFA' },
  'apartment:table': { role: 'TABLE', asset: null, key: 'apt:TABLE' },
  'apartment:kitchen_counter': { role: 'KITCHEN', asset: null, key: 'apt:KITCHEN' },
  'apartment:fridge': { role: 'FRIDGE', asset: null, key: 'apt:FRIDGE' },
  'apartment:toilet': { role: 'TOILET', asset: null, key: 'apt:TOILET' },
  'apartment:sink': { role: 'SINK', asset: null, key: 'apt:SINK' },
  'apartment:smartphone': { role: 'SMARTPHONE', asset: null, key: 'apt:SMARTPHONE' },
};

/** Nur exakte, bewusst registrierte Anzeigenamen; kein Muster, kein `includes`. */
const LABEL_ROLES: Readonly<Record<string, FurnitureRoleResolution>> = {
  'eigenes bett': { role: 'BED', asset: null, key: 'label:BED' },
  kleiderschrank: { role: 'WARDROBE', asset: null, key: 'label:WARDROBE' },
  sofa: { role: 'SOFA', asset: 'decor/lounge-sofa.png', key: 'label:SOFA' },
  wohnzimmertisch: { role: 'TABLE', asset: null, key: 'label:TABLE' },
  kühlschrank: { role: 'FRIDGE', asset: null, key: 'label:FRIDGE' },
  'kochnische mit spüle': { role: 'KITCHEN', asset: null, key: 'label:KITCHEN' },
  toilette: { role: 'TOILET', asset: null, key: 'label:TOILET' },
  'waschbecken & spiegel': { role: 'SINK', asset: null, key: 'label:SINK' },
  smartphone: { role: 'SMARTPHONE', asset: null, key: 'label:SMARTPHONE' },
  sessel: { role: 'ARMCHAIR', asset: 'decor/vip-armchair.png', key: 'label:ARMCHAIR' },
  palme: { role: 'PALM', asset: 'decor/potted-palm.png', key: 'label:PALM' },
  pflanze: { role: 'PLANT', asset: 'decor/planter-greenery.png', key: 'label:PLANT' },
  neon: { role: 'NEON', asset: 'decor/neon-column.png', key: 'label:NEON' },
  säule: { role: 'COLUMN', asset: 'decor/casino-column.png', key: 'label:COLUMN' },
  kronleuchter: { role: 'CHANDELIER', asset: 'decor/chandelier.png', key: 'label:CHANDELIER' },
  kandelaber: { role: 'CANDELABRA', asset: 'decor/gold-candelabra.png', key: 'label:CANDELABRA' },
  'ägyptische katze': { role: 'STATUE', asset: 'decor/egyptian-cat-statue.png', key: 'label:STATUE' },
  seil: { role: 'ROPE', asset: 'decor/velvet-rope-barrier.png', key: 'label:ROPE' },
  lampe: { role: 'LAMP', asset: 'decor/pendant-lamp.png', key: 'label:LAMP' },
  zeitung: { role: 'NEWSPAPER', asset: 'decor/casino-newspaper.png', key: 'label:NEWSPAPER' },
  tisch: { role: 'SIDE_TABLE', asset: 'decor/casino-side-table.png', key: 'label:SIDE_TABLE' },
  theke: { role: 'COUNTER', asset: 'decor/bar-counter-stools.png', key: 'label:COUNTER' },
  schild: { role: 'SIGN', asset: 'decor/casino-neon-sign.png', key: 'label:SIGN' },
  spiegel: { role: 'MIRROR', asset: null, key: 'label:MIRROR' },
  // Stadtportale sind bekannte Rollen, keine geratene Casino-Deko.
  'dein casino': { role: 'SIGN', asset: 'decor/casino-neon-sign.png', key: 'city:SIGN' },
  markt: { role: 'SIGN', asset: 'decor/cocktail-neon-sign.png', key: 'city:MARKT' },
  hof: { role: 'SIGN', asset: 'decor/casino-neon-sign.png', key: 'city:HOF' },
  nachbarschaft: { role: 'SIGN', asset: 'decor/casino-neon-sign.png', key: 'city:NACHBARSCHAFT' },
};

/** Löst eine Rolle ausschließlich aus stabilen IDs und exakten Labels. */
export function resolveFurnitureRole(item: Furniture): FurnitureRoleResolution | null {
  if (item.artId) {
    const art = ART_ROLES[item.artId];
    if (art) return art;
  }
  if (item.gameId) return GAME_ROLES[item.gameId] ?? null;
  const kind = KIND_ROLES[item.kind];
  if (kind) return kind;
  if (item.kind !== 'DECOR') return null;
  return LABEL_ROLES[item.label.trim().toLowerCase()] ?? null;
}

/** Ein unbekanntes Möbel bleibt sichtbar unaufgelöst, keine geratene Rolle. */
export const isUnresolvedFurniture = (item: Furniture): boolean => resolveFurnitureRole(item) === null;
