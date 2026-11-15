/**
 * Konfiguration fuer den Hot-Event-Score (#806).
 *
 * Die Schwellen liegen hier und nicht im Scheduler: Wer eine andere
 * Virlitaet will, aendert diese Datei und keine Sonderlogik im Event-Pfad.
 * Jede Zahl ist eine Normalisierung, kein versteckter Produktwert: Sie sagt,
 * welche Groesse als "volle Wirkung" zaehlt.
 */
import { NARRATIVE_FACT_KINDS } from './types';

/** Die geschlossene Liste der Fact-Arten; abgeleitet, nicht kopiert. */
type HotEventFactKind = (typeof NARRATIVE_FACT_KINDS)[number];

/** Die Faktoren, aus denen Hitze entsteht; jeder Fact liefert nur, was er belegt. */
export type HotEventFactor = 'reach' | 'consequence' | 'novelty' | 'conflict' | 'achievement';

export const HOT_EVENT_FACTORS: readonly HotEventFactor[] = [
  'reach', 'consequence', 'novelty', 'conflict', 'achievement',
];

export interface HotEventConfig {
  /** Gewicht je Faktor; ein Faktor ohne Gewicht zaehlt nicht. */
  readonly weights: Readonly<Record<HotEventFactor, number>>;
  /** Eigene Schwelle je Fact-Art; fehlt sie, gilt `defaultThreshold`. */
  readonly thresholds: Readonly<Partial<Record<HotEventFactKind, number>>>;
  readonly defaultThreshold: number;
  /** So weit zurueck zaehlt die Neuigkeit. */
  readonly noveltyWindowTicks: number;
  /** So viele gleichartige Facts im Fenster machen die Neuigkeit zu null. */
  readonly noveltySaturation: number;
  /** VC-Betrag, der als volle Wirkung zaehlt (aus `fromVC`). */
  readonly vcScale: number;
  /** 0..100-Bewertung, die als volle Wirkung zaehlt (z. B. `VisitEndedFact.score`). */
  readonly scoreScale: number;
}

/**
 * Default-Kalibrierung: Alltag bleibt unter der Schwelle, belegte Konflikte,
 * Sabotage und grosse Geldbewegungen kommen darueber.
 */
export const HOT_EVENT_CONFIG: HotEventConfig = {
  weights: { reach: 1, consequence: 3, novelty: 2, conflict: 4, achievement: 3 },
  thresholds: {
    VISITOR_CONFLICT: 7,
    RIVAL_ACTION: 7,
    SLOT_DISCHARGE: 6,
    RIVAL_ENCOUNTER: 4,
    HOUSE_BALANCE: 4,
    VISIT_ENDED: 4,
    EVENT_RESOLVED: 4,
    DEVICE_FAULT: 6,
    STOCK_LOW: 6,
  },
  defaultThreshold: 8,
  noveltyWindowTicks: 240,
  noveltySaturation: 4,
  vcScale: 50,
  scoreScale: 80,
};

interface HotEventConfigResult {
  readonly ok: boolean;
  /** Leer bei Erfolg; sonst der erste konkrete Verstoss. */
  readonly reason: string;
  readonly config: HotEventConfig;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isCount = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min;

const fail = (reason: string, config: HotEventConfig): HotEventConfigResult => ({ ok: false, reason, config });

/**
 * Validiert eine rohe Konfiguration vollstaendig und liefert die
 * normalisierte Fassung. Unbekannte Fact-Arten und negative Gewichte werden
 * abgelehnt, statt still ignoriert zu werden.
 */
export function validateHotEventConfig(raw: unknown): HotEventConfigResult {
  if (!isRecord(raw)) return fail('Konfiguration fehlt.', HOT_EVENT_CONFIG);
  const weightsRaw = raw.weights;
  if (!isRecord(weightsRaw)) return fail('weights fehlt.', HOT_EVENT_CONFIG);
  const weights: Record<HotEventFactor, number> = { ...HOT_EVENT_CONFIG.weights };
  for (const factor of HOT_EVENT_FACTORS) {
    const value = weightsRaw[factor];
    if (!isPositive(value) && value !== 0) return fail(`weights.${factor} ist keine Zahl >= 0.`, HOT_EVENT_CONFIG);
    weights[factor] = value;
  }
  const thresholdsRaw = raw.thresholds ?? {};
  if (!isRecord(thresholdsRaw)) return fail('thresholds ist kein Objekt.', HOT_EVENT_CONFIG);
  const thresholds: Partial<Record<HotEventFactKind, number>> = {};
  for (const [kind, value] of Object.entries(thresholdsRaw)) {
    if (!(NARRATIVE_FACT_KINDS as readonly string[]).includes(kind)) {
      return fail(`Unbekannte Fact-Art in thresholds: ${kind}.`, HOT_EVENT_CONFIG);
    }
    if (!isPositive(value)) return fail(`thresholds.${kind} muss > 0 sein.`, HOT_EVENT_CONFIG);
    thresholds[kind as HotEventFactKind] = value;
  }
  const defaultThreshold = raw.defaultThreshold ?? HOT_EVENT_CONFIG.defaultThreshold;
  if (!isPositive(defaultThreshold)) return fail('defaultThreshold muss > 0 sein.', HOT_EVENT_CONFIG);
  const noveltyWindowTicks = raw.noveltyWindowTicks ?? HOT_EVENT_CONFIG.noveltyWindowTicks;
  if (!isCount(noveltyWindowTicks, 0)) return fail('noveltyWindowTicks muss eine ganze Zahl >= 0 sein.', HOT_EVENT_CONFIG);
  const noveltySaturation = raw.noveltySaturation ?? HOT_EVENT_CONFIG.noveltySaturation;
  if (!isCount(noveltySaturation, 1)) return fail('noveltySaturation muss eine ganze Zahl >= 1 sein.', HOT_EVENT_CONFIG);
  const vcScale = raw.vcScale ?? HOT_EVENT_CONFIG.vcScale;
  if (!isPositive(vcScale)) return fail('vcScale muss > 0 sein.', HOT_EVENT_CONFIG);
  const scoreScale = raw.scoreScale ?? HOT_EVENT_CONFIG.scoreScale;
  if (!isPositive(scoreScale)) return fail('scoreScale muss > 0 sein.', HOT_EVENT_CONFIG);
  return {
    ok: true,
    reason: '',
    config: {
      weights, thresholds, defaultThreshold, noveltyWindowTicks, noveltySaturation, vcScale, scoreScale,
    },
  };
}
