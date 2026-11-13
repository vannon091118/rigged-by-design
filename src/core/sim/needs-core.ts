/**
 * @module needs-core — gemeinsamer Kern der drei Needs-Modelle
 *
 * Spieler (Hunger/Durst), Stadt-NPCs (sechs Werte) und Gaeste (Durst/Blase)
 * speichern ihre Werte getrennt, teilen aber dieselben Regeln: 0..100,
 * Drift und Sättigung werden geklemmt, Schwellen werden an derselben Stelle
 * verglichen. Die Modelle behalten ihre Felder, Raten und fachlichen Folgen.
 */
import { clamp } from './num';

const NEED_MIN = 0;
const NEED_MAX = 100;

/** Beduerfniswert 0..100 ohne Rundung — fuer Modelle mit Nachkommastellen. */
export const clampNeedValue = (value: number): number =>
  clamp(value, NEED_MIN, NEED_MAX);

/** Gespeicherter Beduerfniswert: 0..100, ganzzahlig. */
export const clampNeed = (value: number): number =>
  Math.round(clampNeedValue(value));

/** Bedarf steigt und bleibt im Bereich; die Raten kommen vom Modell. */
export const driftNeed = (value: number, ...amounts: readonly number[]): number => {
  let result = value;
  for (const amount of amounts) result += amount;
  return clampNeedValue(result);
};

/** Saettigung senkt den Bedarf und bleibt im Bereich; die Raten kommen vom Modell. */
export const satisfyNeed = (value: number, ...amounts: readonly number[]): number => {
  let result = value;
  for (const amount of amounts) result -= amount;
  return clampNeedValue(result);
};

/** Eine Schwelle ist erreicht; die konkrete Grenze bleibt Fachwissen. */
export const needAtLeast = (value: number, threshold: number): boolean =>
  value >= threshold;

/** Eine Schwelle ist noch nicht ueberschritten; die Grenze bleibt Fachwissen. */
export const needAtMost = (value: number, threshold: number): boolean =>
  value <= threshold;
