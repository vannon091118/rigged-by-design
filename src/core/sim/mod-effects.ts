/**
 * Mod-Katalog und der eine Resolver fuer Mod-Wirkungen.
 *
 * Aus `offers.ts` ausgelagert (Hot Zone): Angebote, Preise und Anziehung bleiben
 * dort, die Mods selbst und ihre Wirkung stehen hier. `offers.ts` re-exportiert
 * die Namen, damit Importeure unveraendert bleiben, und liest selbst nur diesen
 * einen Resolver.
 *
 * Item-Synergien liegen auf demselben Weg: `resolveModEffects` summiert Mod-
 * Wirkungen und aktive Paar-Synergien in einem Aufruf. Eigenes Haus, fremde
 * Haeuser, eigene Spielrunden und Rivalen teilen ihn.
 */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { synergyEffects } from './item-synergy';
import type { GameId, ModId } from './types';

export interface ModDef {
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

/** Einige Mods passen nur auf bestimmte Spieltypen; ohne Liste gilt er ueberall. */
const MOD_GAMES: Partial<Record<ModId, readonly GameId[]>> = { EXTRA_REEL: ['SLOT'] };

/** Die eine Ja/Nein-Frage: gilt dieser Mod auf diesem Spieltyp? */
export function modAppliesTo(modId: ModId, game: GameId | undefined): boolean {
  const allowed = MOD_GAMES[modId];
  return allowed === undefined || (game !== undefined && allowed.includes(game));
}

export interface ModEffects {
  attraction: number; patience: number; addiction: number; operating: VaCoinMicro; bonusBps: number;
  /** FREE_DRINK liefert genau einen Drink je Spin, solange die Bar Bestand hat. */
  freeDrink: boolean;
  /** Der auf den Drink entfallende Betriebsanteil; wird nur bei Lieferung gebucht. */
  freeDrinkCost: VaCoinMicro;
}

/**
 * Der gemeinsame Resolver fuer Mod- und Item-Wirkungen: eigenes Haus und fremde
 * Hauser rechnen hier ueber denselben Weg – mit Spieltyp, damit eine Regel wie
 * "die vierte Walze nur fuer Slots" nicht an zwei Stellen leben darf.
 */
export function resolveModEffects(game: GameId | undefined, mods: readonly ModId[]): ModEffects {
  let attraction = 0;
  let patience = 0;
  let addiction = 0;
  let operating = 0;
  let bonusBps = 0;
  let freeDrink = false;
  let freeDrinkCost = 0;
  const applicable: ModId[] = [];
  // Dieselbe Mod-Id darf ihre Wirkung nur einmal entfalten, auch wenn ein
  // alter Spielstand sie doppelt im Gerät traegt.
  for (const id of new Set(mods)) {
    if (!modAppliesTo(id, game)) continue;
    applicable.push(id);
    const mod = getMod(id);
    attraction += mod.attraction;
    patience += mod.patience;
    addiction += mod.addiction;
    operating += mod.operating;
    bonusBps += mod.bonusBps;
    if (id === 'FREE_DRINK') { freeDrink = true; freeDrinkCost += mod.operating; }
  }
  // Item-Synergien laufen auf demselben Resolver: Vorteil und Nachteil einer
  // Paarung gelten fuer eigenes Haus, fremde Haeuser und eigene Runden zugleich.
  const synergy = synergyEffects(applicable);
  return {
    attraction: attraction + synergy.attraction,
    patience: patience + synergy.patience,
    addiction: addiction + synergy.addiction,
    operating: (operating + synergy.operating) as VaCoinMicro,
    bonusBps,
    freeDrink, freeDrinkCost: freeDrinkCost as VaCoinMicro,
  };
}
