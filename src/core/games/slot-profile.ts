/**
 * Konfigurierbare Spielmechanik des Slots: Gewichte, Bewertungsmodell, Volatilitaet,
 * Wild/Scatter, Bonus-Paytable und Auszahlungsprofil.
 *
 * Die Chancen kommen aus derselben Engine, die den Spin auswertet – was hier
 * steht, ist keine Beschreibung, sondern die Rechnung.
 */
import {
  clampedReels, SLOT_SYMBOLS, WEIGHTS, slotPaylines, weightTotal, type SlotSymbol, type SlotWeights,
} from './engines/slot-paytable';
import { freeRounds, payScaleFor, triggerChance } from './engines/slot-odds';
import { modelExpectation, type PayModel, type Volatility } from './engines/slot-models';
import { reelChances } from './engines/slot-strips';

export type { PayModel, Volatility } from './engines/slot-models';

export interface SlotProfile {
  /** Gewichte je Symbol; gelten, solange kein Streifen gesetzt ist. */
  readonly weights: SlotWeights;
  /** Walzenstreifen je Walze: die Ziehung nimmt dann gleichverteilt aus dem Streifen. */
  readonly reelStrips: readonly (readonly SlotSymbol[])[];
  readonly payScaleBps: number;
  /** Eigene Paytable fuer die Bonusspiele, relativ zur Basis (5 000–20 000 bps). */
  readonly bonusPayScaleBps: number;
  readonly model: PayModel;
  readonly volatility: Volatility;
  readonly wildMode: 'NONE' | 'BOOK';
  readonly scatter: boolean;
  readonly freeSpins: number;
  /** Gewinnmultiplikator in Freispielen (1–5). */
  readonly multiplier: number;
}

export const MIN_PAY_SCALE_BPS = 5_000;
export const MAX_PAY_SCALE_BPS = 12_000;
export const MIN_BONUS_SCALE_BPS = 5_000;
export const MAX_BONUS_SCALE_BPS = 20_000;
const MAX_WEIGHT = 99;

export const DEFAULT_SLOT_PROFILE: SlotProfile = {
  weights: WEIGHTS, reelStrips: [], payScaleBps: 10_000, bonusPayScaleBps: 10_000,
  model: 'LINES', volatility: 'MID', wildMode: 'BOOK', scatter: true, freeSpins: 10, multiplier: 1,
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const PAY_MODELS: readonly PayModel[] = ['LINES', 'WAYS', 'CLUSTER'];
const VOLATILITIES: readonly Volatility[] = ['LOW', 'MID', 'HIGH'];

/** Alte Staende und fremde Eingaben landen auf einem spielbaren Profil, nie auf NaN. */
export function normalizeSlotProfile(raw: unknown): SlotProfile {
  const source = (raw ?? {}) as Partial<SlotProfile> & { rules?: { freeSpins?: boolean; wildBooks?: boolean } };
  const rawWeights = (source.weights ?? {}) as Partial<Record<SlotSymbol, unknown>>;
  const weights = {} as Record<SlotSymbol, number>;
  let total = 0;
  for (const symbol of SLOT_SYMBOLS) {
    const parsed = Number(rawWeights[symbol]);
    const weight = Number.isFinite(parsed) ? clampInt(parsed, WEIGHTS[symbol], 0, MAX_WEIGHT) : WEIGHTS[symbol];
    weights[symbol] = weight;
    total += weight;
  }
  const strips = Array.isArray(source.reelStrips)
    ? source.reelStrips
      .filter((strip) => Array.isArray(strip) && strip.length > 0)
      .map((strip: readonly SlotSymbol[]) => strip.filter((symbol) => SLOT_SYMBOLS.includes(symbol)))
      .filter((strip) => strip.length > 0)
    : [];
  if (total <= 0 && strips.length === 0) return DEFAULT_SLOT_PROFILE;
  const legacy = source.rules;
  const model = PAY_MODELS.includes(source.model as PayModel) ? source.model as PayModel : 'LINES';
  const volatility = VOLATILITIES.includes(source.volatility as Volatility) ? source.volatility as Volatility : 'MID';
  return {
    weights,
    reelStrips: strips,
    payScaleBps: clampInt(source.payScaleBps, 10_000, MIN_PAY_SCALE_BPS, MAX_PAY_SCALE_BPS),
    bonusPayScaleBps: clampInt(source.bonusPayScaleBps, 10_000, MIN_BONUS_SCALE_BPS, MAX_BONUS_SCALE_BPS),
    model,
    volatility,
    // Ein altes Profil kannte nur `rules`; die Regeln gelten weiter.
    wildMode: source.wildMode === 'NONE' || legacy?.wildBooks === false ? 'NONE' : 'BOOK',
    scatter: source.scatter !== false && legacy?.freeSpins !== false,
    freeSpins: clampInt(source.freeSpins, 10, 0, 20),
    multiplier: clampInt(source.multiplier, 1, 1, 5),
  };
}

export function sameSlotProfile(a: SlotProfile, b: SlotProfile): boolean {
  return a.payScaleBps === b.payScaleBps && a.bonusPayScaleBps === b.bonusPayScaleBps
    && a.model === b.model && a.volatility === b.volatility && a.wildMode === b.wildMode
    && a.scatter === b.scatter && a.freeSpins === b.freeSpins && a.multiplier === b.multiplier
    && a.reelStrips.length === b.reelStrips.length
    && SLOT_SYMBOLS.every((symbol) => a.weights[symbol] === b.weights[symbol]);
}

interface SlotChances {
  readonly rtpBps: number;
  readonly lineHitBps: number;
  readonly linesPerSpin: number;
  readonly bonusEvery: number;
  readonly freeRounds: number;
  readonly perSymbolBps: Readonly<Record<SlotSymbol, number>>;
  readonly modelHint: string;
}

function modelHint(model: PayModel, lines: number, hitBps: number): string {
  if (model === 'WAYS') return 'Ways: jede Walze mit Treffer zählt';
  if (model === 'CLUSTER') return 'Cluster: gleiche Symbole im ganzen Gitter';
  return lines + ' Linien, ' + (hitBps / 100).toFixed(2).replace('.', ',') + ' % Treffer je Linie';
}

/** Trefferchance einer Linie in Basispunkten, exakt ueber die Folgen. */
function perLineHit(reels: number, profile: SlotProfile): number {
  let hit = 0;
  const total = weightTotal(profile.weights);
  for (const symbol of SLOT_SYMBOLS) {
    const wild = profile.wildMode === 'BOOK' && symbol !== 'BOOK' ? profile.weights.BOOK : 0;
    const chance = total > 0 ? (profile.weights[symbol] + wild) / total : 0;
    for (let run = 3; run <= reels; run += 1) hit += chance ** run * (run === reels ? 1 : 1 - chance);
  }
  return hit * 10_000;
}

/** Chancen eines Profils, aus denselben Funktionen, die den Spin auswerten. */
export function slotChances(reels: number, raw: unknown): SlotChances {
  const profile = normalizeSlotProfile(raw);
  const clamped = clampedReels(reels);
  const lines = slotPaylines(clamped).length;
  const scale = payScaleFor(clamped, profile.weights, {
    model: profile.model, volatility: profile.volatility, payScaleBps: profile.payScaleBps,
  });
  const base = modelExpectation(profile.model, clamped, profile.weights, profile.wildMode === 'BOOK', profile.volatility);
  const rounds = profile.scatter && profile.freeSpins > 0
    ? freeRounds(triggerChance(clamped, profile.weights), profile.freeSpins) : 0;
  const bonusFactor = 1 + rounds * (profile.bonusPayScaleBps / 10_000) * profile.multiplier;
  const chances = reelChances(profile, 0);
  const perSymbolBps = {} as Record<SlotSymbol, number>;
  for (const symbol of SLOT_SYMBOLS) perSymbolBps[symbol] = Math.round(chances[symbol] * 10_000);
  const hitBps = perLineHit(clamped, profile);
  return {
    rtpBps: Math.round(base * scale * bonusFactor),
    lineHitBps: profile.model === 'LINES' ? Math.round(hitBps) : 0,
    linesPerSpin: profile.model === 'LINES' ? Number(((lines * hitBps) / 10_000).toFixed(2)) : 0,
    bonusEvery: rounds > 0 ? Math.max(1, Math.round(1 / rounds)) : 0,
    freeRounds: Number(rounds.toFixed(3)),
    perSymbolBps,
    modelHint: modelHint(profile.model, lines, hitBps),
  };
}
