/** Angebot: kaufbare Spiele, Deko und Mods. Jeder Mod zieht an und kostet Geduld oder Betrieb. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { GAME_FOOTPRINT } from './grid-zones';
import { getPersona } from './personas';
import type { Furniture, GameId, Guest, ModId, WorldState } from './types';

export type BuildId = GameId | 'PLANT' | 'SOFA';

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
];

const BUILD_INDEX = new Map(BUILD_DEFS.map((def) => [def.id, def]));
export function getBuildDef(id: BuildId): BuildDef {
  const def = BUILD_INDEX.get(id);
  if (!def) throw new Error(`Unbekanntes Objekt: ${id}`);
  return def;
}

interface ModDef {
  readonly id: ModId;
  readonly name: string;
  readonly description: string;
  readonly cost: VaCoinMicro;
  readonly attraction: number;
  readonly patience: number;
  readonly addiction: number;
  readonly operating: VaCoinMicro;
  /** Aufschlag auf gewonnene Runden, fliesst in den Spiel-Vertrag. */
  readonly bonusBps: number;
}

export const MODS: readonly ModDef[] = [
  {
    id: 'NEON', name: 'Neon-Rahmen', description: 'Leuchtet bis zur Straße. +Anziehung, +Geduld.',
    cost: fromVC(6), attraction: 260, patience: 3, addiction: 1, operating: fromVC(0.01), bonusBps: 0,
  },
  {
    id: 'CHERRY', name: 'Kirschen-Flut', description: 'Mehr kleine Treffer. Fühlt sich nach Gewinn an, kostet Geduld.',
    cost: fromVC(8), attraction: 160, patience: -2, addiction: 4, operating: fromVC(0), bonusBps: 120,
  },
  {
    id: 'NEAR_MISS', name: 'Fast-Gewinn-Magnet', description: 'Nieten sehen aus wie Jackpots. Zieht stark, macht ungeduldig.',
    cost: fromVC(12), attraction: 320, patience: -7, addiction: 6, operating: fromVC(0), bonusBps: 0,
  },
  {
    id: 'FREE_DRINK', name: 'Freier Fusel', description: 'Ein Drink pro Spin. Gäste halten länger, du zahlst Betrieb.',
    cost: fromVC(10), attraction: 140, patience: 8, addiction: 2, operating: fromVC(0.03), bonusBps: 0,
  },
  {
    id: 'EXTRA_REEL', name: 'Vierte Walze', description: 'Mehr Kombinationen, mehr Schauwert. Nur für Slots.',
    cost: fromVC(18), attraction: 300, patience: -3, addiction: 3, operating: fromVC(0), bonusBps: 0,
  },
  {
    id: 'VELVET', name: 'Samtverkleidung', description: 'Fühlt sich teuer an. Bessere Gäste, weniger Geduld.',
    cost: fromVC(14), attraction: 220, patience: -2, addiction: 1, operating: fromVC(0.02), bonusBps: 0,
  },
];

const MOD_INDEX = new Map(MODS.map((mod) => [mod.id, mod]));
export function getMod(id: ModId): ModDef {
  const mod = MOD_INDEX.get(id);
  if (!mod) throw new Error(`Unbekannter Mod: ${id}`);
  return mod;
}

export function modEffects(item: { readonly mods: readonly ModId[] }): {
  attraction: number; patience: number; addiction: number; operating: VaCoinMicro; bonusBps: number;
} {
  let attraction = 0;
  let patience = 0;
  let addiction = 0;
  let operating = 0;
  let bonusBps = 0;
  for (const id of item.mods) {
    const mod = getMod(id);
    attraction += mod.attraction;
    patience += mod.patience;
    addiction += mod.addiction;
    operating += mod.operating;
    bonusBps += mod.bonusBps;
  }
  return { attraction, patience, addiction, operating: operating as VaCoinMicro, bonusBps };
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
  const effects = modEffects(item);
  const taste = persona.taste[item.gameId] ?? 0;
  const priceFriction = bet > wallet * 0.25 ? (bet / Math.max(1, wallet)) * 900 : 0;
  const moodFactor = 0.55 + guest.mood / 140;
  return Math.max(1, Math.round((420 + item.quality * 160 + effects.attraction + taste + reelPull(item)) * moodFactor - priceFriction));
}

export function attractionValue(item: Furniture): number {
  return item.quality * 160 + modEffects(item).attraction + reelPull(item);
}

export function attractionOf(world: WorldState): number {
  let total = 0;
  for (const item of world.furniture) {
    if (item.kind === 'DECOR') total += item.quality * 120;
    else if (item.gameId) total += item.quality * 180 + modEffects(item).attraction + reelPull(item);
  }
  return total;
}
