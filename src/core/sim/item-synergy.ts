/**
 * Items auf dem bestehenden Mod-Bestand: Seltenheit, Synergie, Vor- und Nachteil.
 *
 * Es gibt kein zweites Regelwerk: ein Item ist ein Mod aus `offers.MODS`. Diese
 * Datei liefert nur Daten, die der vorhandene Resolver liest - `resolveModEffects`
 * summiert Synergien auf demselben Weg wie Mods. Damit gelten Seltenheit und
 * Synergie gleichzeitig fuer eigenes Haus, fremde Haeuser, eigene Spielrunden und
 * den Engine-Bias aus `core/games/mod-profile.ts`.
 *
 * Kein neues Save-Feld: das Inventar ist die Menge der verbauten `item.mods`,
 * die Sammlung ist daraus abgeleitet (`item-inventory.ts`).
 */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModId } from './types';

export type ItemRarity = 'COMMON' | 'RARE' | 'LEGENDARY';

/** Seltenheit je Mod-Id; jede Katalog-Id steht hier (der Test haelt das fest). */
export const ITEM_RARITY: Record<ModId, ItemRarity> = {
  NEON: 'COMMON',
  CHERRY: 'COMMON',
  FREE_DRINK: 'RARE',
  VELVET: 'RARE',
  NEAR_MISS: 'RARE',
  EXTRA_REEL: 'LEGENDARY',
};

export const RARITY_LABEL: Record<ItemRarity, string> = {
  COMMON: 'Gewöhnlich',
  RARE: 'Selten',
  LEGENDARY: 'Legendär',
};

/** Die einzige Reihenfolge fuer Anzeige und Zaehlung. */
export const RARITY_ORDER: readonly ItemRarity[] = ['COMMON', 'RARE', 'LEGENDARY'];

export interface SynergyDef {
  readonly id: string;
  /** Beide Items muessen auf derselben Maschine verbaut sein. */
  readonly mods: readonly [ModId, ModId];
  readonly name: string;
  /** Der Vorteil in Worten; die Zahl steht in den Wirkungsfeldern. */
  readonly advantage: string;
  /** Der Nachteil in Worten - jede Synergie kostet etwas. */
  readonly drawback: string;
  readonly attraction: number;
  readonly patience: number;
  readonly addiction: number;
  readonly operating: VaCoinMicro;
}

/**
 * Paar-Synergien: mehr Zulauf, Laune oder Sucht gegen echte Betriebskosten.
 * Bewusst ohne `bonusBps` - die Auszahlungsquote bleibt Sache der Mods und der
 * Engine, damit eine Synergie den RTP nicht still verschiebt.
 */
export const SYNERGIES: readonly SynergyDef[] = [
  {
    id: 'KOEDER_DOPPEL',
    mods: ['CHERRY', 'NEAR_MISS'],
    name: 'Köder-Doppel',
    advantage: '+140 Anziehung',
    drawback: '+0,02 Betrieb je Tick',
    attraction: 140, patience: 0, addiction: 0, operating: fromVC(0.02),
  },
  {
    id: 'GLAMOUR_FASSADE',
    mods: ['NEON', 'VELVET'],
    name: 'Glamour-Fassade',
    advantage: '+180 Anziehung',
    drawback: '+0,02 Betrieb je Tick',
    attraction: 180, patience: 0, addiction: 0, operating: fromVC(0.02),
  },
  {
    id: 'LOUNGE_SERVICE',
    mods: ['FREE_DRINK', 'VELVET'],
    name: 'Lounge-Service',
    advantage: '+6 Geduld',
    drawback: '+0,03 Betrieb je Tick',
    attraction: 0, patience: 6, addiction: 0, operating: fromVC(0.03),
  },
  {
    id: 'SUESSER_KOEDER',
    mods: ['CHERRY', 'FREE_DRINK'],
    name: 'Süßer Köder',
    advantage: '+3 Sucht',
    drawback: '+0,01 Betrieb je Tick',
    attraction: 0, patience: 0, addiction: 3, operating: fromVC(0.01),
  },
  {
    id: 'NACHTBETRIEB',
    mods: ['NEON', 'FREE_DRINK'],
    name: 'Nachtbetrieb',
    advantage: '+90 Anziehung, +2 Geduld',
    drawback: '+0,02 Betrieb je Tick',
    attraction: 90, patience: 2, addiction: 0, operating: fromVC(0.02),
  },
];

const pairKey = (a: ModId, b: ModId): string => [a, b].sort().join('|');

const SYNERGY_BY_PAIR = new Map(SYNERGIES.map((entry) => [pairKey(entry.mods[0], entry.mods[1]), entry]));

/**
 * Alle Synergien, deren beide Items vorhanden sind. Die Reihenfolge folgt dem
 * Katalog, damit Anzeige und Tests stabil bleiben; doppelte Mod-Ids zaehlen wie
 * beim Resolver nur einmal.
 */
export function activeSynergies(mods: readonly ModId[]): readonly SynergyDef[] {
  const present = new Set(mods);
  if (present.size < 2) return [];
  const found: SynergyDef[] = [];
  for (const entry of SYNERGIES) {
    if (present.has(entry.mods[0]) && present.has(entry.mods[1])) found.push(entry);
  }
  return found;
}

export interface SynergyEffects {
  readonly attraction: number;
  readonly patience: number;
  readonly addiction: number;
  readonly operating: VaCoinMicro;
}

/** Die Summe aller aktiven Synergien; der Aufrufer uebergibt nur passende Items. */
export function synergyEffects(mods: readonly ModId[]): SynergyEffects {
  let attraction = 0;
  let patience = 0;
  let addiction = 0;
  let operating = 0;
  for (const entry of activeSynergies(mods)) {
    attraction += entry.attraction;
    patience += entry.patience;
    addiction += entry.addiction;
    operating += entry.operating;
  }
  return { attraction, patience, addiction, operating: operating as VaCoinMicro };
}

/** Nur fuer Tests und Anzeige: die Synergie zu einem Paar, falls es eine gibt. */
export function synergyOf(a: ModId, b: ModId): SynergyDef | null {
  return SYNERGY_BY_PAIR.get(pairKey(a, b)) ?? null;
}
