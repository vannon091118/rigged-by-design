/**
 * Konfigurierbare Spielmechanik des Slots: Symbolgewichte, Auszahlungsprofil
 * und Regeln. Die Chancen kommen aus derselben Engine, die den Spin auswertet –
 * was hier steht, ist keine Beschreibung, sondern die Rechnung.
 */
import {
  clampedReels, SLOT_SYMBOLS, WEIGHTS, slotPaylines, type SlotSymbol, type SlotWeights,
} from './engines/slot-paytable';
import { freeRounds, lineOdds, payScaleFor, slotJackpotInterval, triggerChance } from './engines/slot-odds';

interface SlotRules {
  /** Buecher loesen Freispiele aus; ausgeschaltet bleibt der Scatter wertlos. */
  readonly freeSpins: boolean;
  /** BOOK zaehlt als Wild in jeder Linie; ausgeschaltet zahlt es nur als eigenes Symbol. */
  readonly wildBooks: boolean;
}

export interface SlotProfile {
  readonly weights: SlotWeights;
  /** Auszahlungsprofil in Basispunkten um den kalibrierten Wert (5 000 bis 12 000). */
  readonly payScaleBps: number;
  readonly rules: SlotRules;
}

export const MIN_PAY_SCALE_BPS = 5_000;
export const MAX_PAY_SCALE_BPS = 12_000;
const MAX_WEIGHT = 99;

export const DEFAULT_SLOT_PROFILE: SlotProfile = {
  weights: WEIGHTS,
  payScaleBps: 10_000,
  rules: { freeSpins: true, wildBooks: true },
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

/** Alte Staende und fremde Eingaben landen auf einem spielbaren Profil, nie auf NaN. */
export function normalizeSlotProfile(raw: unknown): SlotProfile {
  const source = (raw ?? {}) as Partial<SlotProfile>;
  const rawWeights = (source.weights ?? {}) as Partial<Record<SlotSymbol, unknown>>;
  const weights = {} as Record<SlotSymbol, number>;
  let total = 0;
  for (const symbol of SLOT_SYMBOLS) {
    const fallback = WEIGHTS[symbol];
    const parsed = Number(rawWeights[symbol]);
    const weight = Number.isFinite(parsed) ? clampInt(parsed, fallback, 0, MAX_WEIGHT) : fallback;
    weights[symbol] = weight;
    total += weight;
  }
  if (total <= 0) return DEFAULT_SLOT_PROFILE;
  const payScaleBps = clampInt(source.payScaleBps, 10_000, MIN_PAY_SCALE_BPS, MAX_PAY_SCALE_BPS);
  return {
    weights,
    payScaleBps,
    rules: {
      freeSpins: source.rules?.freeSpins !== false,
      wildBooks: source.rules?.wildBooks !== false,
    },
  };
}

/** Zwei Profile sind gleich, wenn sich kein wirksamer Wert unterscheidet. */
export function sameSlotProfile(a: SlotProfile, b: SlotProfile): boolean {
  return a.payScaleBps === b.payScaleBps
    && a.rules.freeSpins === b.rules.freeSpins
    && a.rules.wildBooks === b.rules.wildBooks
    && SLOT_SYMBOLS.every((symbol) => a.weights[symbol] === b.weights[symbol]);
}

interface SlotChances {
  /** Auszahlungsquote in Basispunkten des Gesamteinsatzes, exakt aus der Engine. */
  readonly rtpBps: number;
  /** Chance in Basispunkten, dass eine einzelne Linie zahlt. */
  readonly lineHitBps: number;
  /** Erwartete Zahl bezahlter Linien je Spin. */
  readonly linesPerSpin: number;
  /** Erwartete Spins bis zum Buch-Jackpot; 0, wenn Freispiele aus sind. */
  readonly jackpotSpins: number;
  /** Erwartete Freispielzuege je Spin. */
  readonly freeRounds: number;
  /** Trefferwahrscheinlichkeit je Symbol in Basispunkten. */
  readonly perSymbolBps: Readonly<Record<SlotSymbol, number>>;
}

/**
 * Chancen eines Profils fuer eine Walzenanzahl. Alles stammt aus `lineOdds`,
 * `triggerChance` und `payScaleFor` – denselben Funktionen, die `playSlot` nutzt.
 */
export function slotChances(reels: number, raw: unknown): SlotChances {
  const profile = normalizeSlotProfile(raw);
  const clamped = clampedReels(reels);
  const lines = slotPaylines(clamped).length;
  const scale = payScaleFor(clamped, profile.weights, profile.payScaleBps);
  const odds = lineOdds(clamped, profile.weights, profile.rules.wildBooks, scale);
  const rounds = profile.rules.freeSpins ? freeRounds(triggerChance(clamped, profile.weights)) : 0;
  const total = SLOT_SYMBOLS.reduce((sum, symbol) => sum + Math.max(0, profile.weights[symbol]), 0);
  const perSymbolBps = {} as Record<SlotSymbol, number>;
  for (const symbol of SLOT_SYMBOLS) {
    perSymbolBps[symbol] = total > 0 ? Math.round((profile.weights[symbol] / total) * 10_000) : 0;
  }
  return {
    rtpBps: Math.round(odds.expectation * (1 + rounds)),
    lineHitBps: Math.round(odds.hitBps),
    linesPerSpin: Number(((lines * odds.hitBps) / 10_000).toFixed(2)),
    jackpotSpins: profile.rules.freeSpins ? slotJackpotInterval(clamped, profile.weights) : 0,
    freeRounds: Number(rounds.toFixed(2)),
    perSymbolBps,
  };
}
