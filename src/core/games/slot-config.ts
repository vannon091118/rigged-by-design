/**
 * Maschinenkonfiguration: die eine Quelle der Spielparameter.
 *
 * Die Engine liest daraus, was sie dreht, die RTP-Rechnung liest daraus, was
 * sie ausweist, und die Migration stellt her, was alte Speicherstaende tragen.
 * Ungueltige Werte werden abgelehnt, nicht stillschweigend korrigiert: eine
 * Maschine mit sechs Walzen ist keine Maschine, die man auf fuenf rundet.
 */
import { clampedReels, SLOT_SYMBOLS, slotPaylines, weightTotal, type SlotSymbol } from './engines/slot-paytable';
import { DEFAULT_SLOT_PROFILE, normalizeSlotProfile, type SlotProfile } from './slot-profile';
import { fromVC, type VaCoinMicro } from '../economy/vacoin';

/** Nur diese Walzenzahlen sind spielbar; alles andere ist ein Konfigurationsfehler. */
export const MIN_REELS = 3;
export const MAX_REELS = 5;
/** Die einzige zugelassene Reihenanzahl; die Chancenrechnung rechnet mit ihr. */
export const ROWS = 3;
const DEFAULT_REELS = 5;

export interface SlotConfig {
  readonly reels: number;
  readonly rows: number;
  readonly paylines: readonly (readonly number[])[];
  readonly symbols: readonly SlotSymbol[];
  readonly weights: SlotProfile['weights'];
  readonly profile: SlotProfile;
}

interface SlotConfigInput {
  readonly reels?: number;
  readonly rows?: number;
  readonly paylines?: readonly (readonly number[])[];
  readonly profile?: unknown;
}

/** Geräteform, die eine Konfiguration liefert; `Furniture` erfüllt sie strukturell. */
interface ReelMachine {
  readonly reels: number;
  readonly slotOdds?: unknown;
}

export function isValidReels(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= MIN_REELS && (value as number) <= MAX_REELS;
}

/** Ableiten einer ungueltigen Zahl für alte Speicherstaende: begrenzen statt verwerfen. */
export function migrateReels(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_REELS;
  return clampedReels(Math.round(parsed));
}

/**
 * Kosten der nächsten Walze: die eine Quelle für die Buchung und für die
 * Oberfläche. Was der Button zeigt, ist genau das, was das Ledger bucht.
 */
export function reelUpgradeCost(reels: number): VaCoinMicro {
  return fromVC(4 + reels * 2);
}

export function assertSlotConfig(config: SlotConfig): void {
  if (!isValidReels(config.reels)) {
    throw new Error(`Walzenzahl ${String(config.reels)} ist ungueltig; erlaubt sind ${MIN_REELS} bis ${MAX_REELS}.`);
  }
  if (config.rows !== ROWS) {
    throw new Error(`Reihen ${String(config.rows)} sind ungueltig; erlaubt ist ${ROWS}.`);
  }
  if (config.symbols.length === 0) throw new Error('Ohne Symbole ist die Konfiguration unspielbar.');
  if (config.profile.reelStrips.length === 0 && weightTotal(config.weights) <= 0) {
    throw new Error('Ohne Gewichte und ohne Streifen ist die Konfiguration unspielbar.');
  }
  if (config.paylines.length === 0) throw new Error('Ohne Gewinnlinien ist die Konfiguration unspielbar.');
  for (const line of config.paylines) {
    if (line.length !== config.reels) {
      throw new Error(`Gewinnlinie mit ${line.length} Feldern passt nicht zu ${config.reels} Walzen.`);
    }
    for (const row of line) {
      if (!Number.isInteger(row) || row < 0 || row >= config.rows) {
        throw new Error(`Gewinnlinie verlaesst das Gitter in Reihe ${String(row)}.`);
      }
    }
  }
}

/** Konfiguration bauen und sofort prüfen: ungültig heißt hier ausschlagen, nicht glätten. */
export function slotConfig(input: SlotConfigInput = {}): SlotConfig {
  const reels = input.reels ?? DEFAULT_REELS;
  const profile = normalizeSlotProfile(input.profile ?? DEFAULT_SLOT_PROFILE);
  const config: SlotConfig = {
    reels,
    rows: input.rows ?? ROWS,
    paylines: input.paylines ?? slotPaylines(reels),
    symbols: [...SLOT_SYMBOLS],
    weights: profile.weights,
    profile,
  };
  assertSlotConfig(config);
  return config;
}

/** Die Konfiguration eines Geräts: dieselbe, die die Engine und die Quote lesen. */
export function slotConfigOf(machine: ReelMachine): SlotConfig {
  return slotConfig({ reels: machine.reels, profile: machine.slotOdds });
}
