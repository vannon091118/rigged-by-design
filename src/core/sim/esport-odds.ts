/**
 * Quoten und Chance des E-Sport-Abends als Blattmodul: Sicht (`esport.ts`) und
 * Abrechnung (`esport-event.ts`) rechnen mit derselben Formel, ohne dass eine
 * der beiden Dateien die andere importieren muss.
 */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';

export type EsportPick = 'HOME' | 'AWAY';
export type EsportTactic = 'KONTROLLE' | 'DRUCK' | 'SPLIT' | 'SPAETSPIEL';

/** Fester Einsatz je Match: ein Preis, keine Verhandlung und kein zweiter Geldweg. */
export const ESPORT_STAKE: VaCoinMicro = fromVC(5);
/** Auszahlungsquote je 10.000 Einsatz: 0,92 als Hausmarge. */
const PAYOUT_MARGIN_BPS = 9_200;
/** Taktik schlägt Taktik: der Konter gibt vier Prozentpunkte, nicht mehr. */
const TACTIC_EDGE_BPS = 400;

/** Wer wen kontert; beide Richtungen sind bewusst nicht symmetrisch definiert. */
const BEATS: Readonly<Record<EsportTactic, EsportTactic>> = {
  KONTROLLE: 'DRUCK',
  DRUCK: 'SPLIT',
  SPLIT: 'SPAETSPIEL',
  SPAETSPIEL: 'KONTROLLE',
};

/**
 * Siegchance aus Stärke und Taktik. Die Stärke bringt Rollen, Attribute und Form
 * bereits mit; die Taktik entscheidet nur den direkten Vergleich.
 */
export function esportChanceBps(
  homeStrength: number, homeTactic: EsportTactic,
  awayStrength: number, awayTactic: EsportTactic,
): number {
  const total = Math.max(1, homeStrength + awayStrength);
  const base = Math.round((homeStrength / total) * 10_000);
  const edge = BEATS[homeTactic] === awayTactic ? TACTIC_EDGE_BPS
    : BEATS[awayTactic] === homeTactic ? -TACTIC_EDGE_BPS : 0;
  return Math.max(500, Math.min(9_500, base + edge));
}

/** Quote aus der Chance: je kleiner die Chance, desto höher die Auszahlung. */
export function esportQuoteBps(chanceBps: number): number {
  return Math.round((PAYOUT_MARGIN_BPS * 10_000) / Math.max(1, chanceBps));
}
