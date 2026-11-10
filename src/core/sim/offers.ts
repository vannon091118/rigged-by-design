/** Angebot: kaufbare Spiele, Deko und Mods. Jeder Mod zieht an und kostet Geduld oder Betrieb. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { GAME_FOOTPRINT } from './grid-zones';
import { resolveModEffects as modEffects } from './mod-effects';
import { dispositionOfGuest } from './narrative/disposition';
import { getPersona } from './personas';
import type { Furniture, GameId, Guest, WorldState } from './types';

export { MODS, getMod, modAppliesTo, resolveModEffects } from './mod-effects';
export type { ModDef, ModEffects } from './mod-effects';

export type BuildId = GameId | 'PLANT' | 'SOFA' | 'SPIEGEL';

interface BuildDef {
  readonly id: BuildId;
  readonly name: string;
  readonly gameId?: GameId;
  readonly kind: Furniture['kind'];
  readonly w: number;
  readonly h: number;
  readonly seats: number;
  readonly cost: VaCoinMicro;
  readonly baseBet: VaCoinMicro;
  readonly quality: number;
  readonly reels: number;
  readonly description: string;
}

const game = (
  id: GameId, name: string, kind: Furniture['kind'],
  cost: number, bet: number, quality: number, reels: number, description: string,
): BuildDef => {
  const fp = GAME_FOOTPRINT[id];
  return {
    id, name, gameId: id, kind, w: fp.w, h: fp.h, seats: fp.seats,
    cost: fromVC(cost), baseBet: fromVC(bet), quality, reels, description,
  };
};

export const BUILD_DEFS: readonly BuildDef[] = [
  game('SLOT', 'Rostiger 3-Walzen-Slot', 'SLOT', 8, 0.5, 1, 3, 'Ein Quadrat, eine Walze, ein Platz. Der Klassiker, der nie ganz sauber wird.'),
  game('PLINKO', 'Plinko-Kabinett', 'SLOT', 16, 0.5, 1, 1, 'Kugeln fallen sichtbar. Gäste bleiben für den einen Tropfen Glück.'),
  game('BLACKJACK', 'Blackjack-Tisch', 'TABLE', 24, 1, 2, 0, 'Vier Plätze, klare Regeln, hohe Nachfrage bei Business-Gästen.'),
  game('POKER', 'Poker-Tisch', 'TABLE', 32, 2, 2, 0, 'Vier Plätze. Wer hier sitzt, will nicht nur spielen, sondern gewinnen.'),
  game('VIDEO_POKER', 'Video-Poker-Terminal', 'SLOT', 18, 1, 2, 0, 'Ein Sitz, ein Bildschirm, neun Zeilen. Halten, tauschen, weiter.'),
  game('ROULETTE', 'Roulette-Tisch', 'TABLE', 42, 2, 3, 0, 'Sechs Plätze am Rad. Zieht High Roller magisch an, teuer im Unterhalt.'),
  game('SHELL', 'Hütchenspiel', 'TABLE', 14, 0.5, 1, 0, 'Ein Hütchen, ein Platz. Schnell, laut, ein bisschen unseriös.'),
  game('DICE', 'Würfeltisch', 'TABLE', 20, 0.5, 1, 0, 'Zwei Plätze, ein Wurf. Einfach zu verstehen, schwer zu lassen.'),
  {
    id: 'PLANT', name: 'Grünpflanze', kind: 'DECOR', w: 1, h: 1, seats: 0, cost: fromVC(2),
    baseBet: fromVC(0), quality: 1, reels: 0, description: 'Macht den Raum weniger nach Lagerhalle.',
  },
  {
    id: 'SOFA', name: 'Samtsofa', kind: 'DECOR', w: 2, h: 1, seats: 2, cost: fromVC(8),
    baseBet: fromVC(0), quality: 2, reels: 0, description: 'Ein Platz zum Warten. Gäste bleiben länger, statt zu gehen.',
  },
  {
    id: 'SPIEGEL', name: 'Spiegel', kind: 'DECOR', w: 1, h: 1, seats: 0, cost: fromVC(4),
    baseBet: fromVC(0), quality: 1, reels: 0, description: 'Zeigt dein Aussehen und öffnet den Charaktereditor.',
  },
];

const BUILD_INDEX = new Map(BUILD_DEFS.map((def) => [def.id, def]));
/** Katalogeintrag ohne Ausnahme: unbekannte Id liefert null statt eines Wurfs. */
export function buildDefOf(id: BuildId): BuildDef | null {
  return BUILD_INDEX.get(id) ?? null;
}
export function getBuildDef(id: BuildId): BuildDef {
  const def = buildDefOf(id);
  if (!def) throw new Error(`Unbekanntes Objekt: ${id}`);
  return def;
}

/** Zusatzwalzen erhoehen den Schauwert und damit den Zulauf. */
function reelPull(item: Furniture): number {
  return item.gameId === 'SLOT' ? Math.max(0, item.reels - 3) * 90 : 0;
}

/** 0 = unspielbar. Hoeher = attraktiver. Persona-Geschmack, Preis, Zustand und Mods zaehlen. */
export function offerScore(world: WorldState, guest: Guest, item: Furniture, wallet: VaCoinMicro): number {
  if (!item.gameId || item.damaged || item.condition < 18 || item.seats <= item.occupants.length) return 0;
  const persona = getPersona(guest.persona);
  const bet = Math.max(world.prices.slotMinBet, item.baseBet);
  if (bet > wallet) return 0;
  const effects = modEffects(item.gameId, item.mods);
  const taste = persona.taste[item.gameId] ?? 0;
  const priceFriction = bet > wallet * 0.25 ? (bet / Math.max(1, wallet)) * 900 : 0;
  const moodFactor = 0.55 + guest.mood / 140;
  // E2E-Disposition: begrenzter Faktor ±20 %, ganzzahlig gerundet, nie null oder negativ.
  const gameFactor = 1 + dispositionOfGuest(world, guest).gameBias;
  return Math.max(1, Math.round((420 + item.quality * 160 + effects.attraction + taste + reelPull(item)) * moodFactor * gameFactor - priceFriction));
}

export function attractionValue(item: Furniture): number {
  return item.quality * 160 + modEffects(item.gameId, item.mods).attraction + reelPull(item);
}

export function attractionOf(world: WorldState): number {
  let total = 0;
  for (const item of world.furniture) {
    if (item.kind === 'DECOR') total += item.quality * 120;
    else if (item.gameId) total += item.quality * 180 + modEffects(item.gameId, item.mods).attraction + reelPull(item);
  }
  return total;
}
