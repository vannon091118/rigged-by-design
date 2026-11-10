/**
 * Mods und die echte Spiel-Engine: die Bruecke, die bisher fehlte.
 *
 * Ein Mod war bis hierher Anziehung, Geduld, Sucht, Betriebskosten und ein
 * Auszahlungsbonus (`offers.resolveModEffects`). Die Maschine selbst drehte
 * aber immer dasselbe Profil. Hier bekommt jeder Mod eine ENGINE-Wirkung auf
 * das vorhandene `SlotProfile`: Gewichte, Auszahlungsprofil, Wild-Regel und
 * Freispiele. Kein neues Save-Feld, kein zweiter Auszahlungspfad - gelesen wird
 * dasselbe Profil, das `slotConfigOf` an die Engine gibt.
 */
import type { SlotProfile } from './slot-profile';
import { normalizeSlotProfile } from './slot-profile';
import type { SlotWeights } from './engines/slot-paytable';
import type { ModId } from '../sim/types';

export interface ModEngineBias {
  /** Verschiebung der Symbolgewichte; wird auf 0..99 begrenzt. */
  readonly weights: Partial<SlotWeights>;
  /** Verschiebung des Auszahlungsprofils in Basispunkten. */
  readonly payScaleBps: number;
  /** Zusaetzliche Freispiele je Ausloesung. */
  readonly freeSpins: number;
}

/**
 * Nur Mods mit einer echten Engine-Wirkung stehen hier. NEON und FREE_DRINK
 * wirken auf Gaeste und Betrieb, EXTRA_REEL auf die Walzenzahl - fuer sie gibt
 * es keine zweite, erfundene Profilwirkung.
 */
export const MOD_ENGINE_BIAS: Partial<Record<ModId, ModEngineBias>> = {
  // Mehr kleine Treffer: die haeufigen Symbole werden haeufiger, das Profil zahlt etwas mehr.
  CHERRY: { weights: { J: 3, Q: 2 }, payScaleBps: 200, freeSpins: 0 },
  // Nieten sehen aus wie Jackpots: das teuerste Symbol rueckt naeher, das Profil zahlt weniger.
  NEAR_MISS: { weights: { SCARAB: 2 }, payScaleBps: -300, freeSpins: 0 },
  // Teure Optik: das Buch (Wild/Scatter) erscheint haeufiger, zwei Freispiele mehr.
  VELVET: { weights: { BOOK: 1 }, payScaleBps: 0, freeSpins: 2 },
};

/** Klartext je Mod fuer die Anzeige; dieselbe Zahl, die die Engine liest. */
export const MOD_ENGINE_NOTE: Partial<Record<ModId, string>> = {
  CHERRY: 'J +3, Q +2 · +2 % Auszahlung',
  NEAR_MISS: 'Skarabäus +2 · −3 % Auszahlung',
  VELVET: 'Buch +1 · +2 Freispiele',
};

const EMPTY_BIAS: ModEngineBias = { weights: {}, payScaleBps: 0, freeSpins: 0 };

/** Die Summe aller Engine-Wirkungen; dieselbe Mod-Id zaehlt nur einmal. */
export function modEngineBias(mods: readonly ModId[]): ModEngineBias {
  const weights: Record<string, number> = {};
  let payScaleBps = 0;
  let freeSpins = 0;
  for (const id of new Set(mods)) {
    const bias = MOD_ENGINE_BIAS[id] ?? EMPTY_BIAS;
    for (const [symbol, delta] of Object.entries(bias.weights)) {
      weights[symbol] = (weights[symbol] ?? 0) + (delta ?? 0);
    }
    payScaleBps += bias.payScaleBps;
    freeSpins += bias.freeSpins;
  }
  return { weights, payScaleBps, freeSpins };
}

/**
 * Das Profil, das die Engine tatsaechlich dreht: Basisprofil plus Engine-Bias.
 * `normalizeSlotProfile` begrenzt die Werte danach auf die spielbaren Bereiche,
 * deshalb kann kein Mod eine Maschine unspielbar machen.
 */
export function withModProfile(base: SlotProfile, mods: readonly ModId[]): SlotProfile {
  const bias = modEngineBias(mods);
  const weights = { ...base.weights } as Record<string, number>;
  for (const [symbol, delta] of Object.entries(bias.weights)) {
    weights[symbol] = (weights[symbol] ?? 0) + delta;
  }
  return normalizeSlotProfile({
    ...base,
    weights,
    payScaleBps: base.payScaleBps + bias.payScaleBps,
    freeSpins: base.freeSpins + bias.freeSpins,
  });
}
