/**
 * Weitergabe als regulaerer Matrix-Kontext: ob jemand ueberhaupt erzaehlt,
 * haengt von Laune, Geselligkeit, eigenem Geruecht und der Beziehung zum
 * Empfaenger ab. Schwelle und Gewichte stehen in `influence-config.ts`, damit
 * es keine zweite, lokal hartkodierte Schwellenkopie gibt.
 */
import {
  INFLUENCE_CONFIG, evaluateInfluence,
  type InfluenceConfig, type InfluenceValues,
} from '../influence';

export function willingToShare(values: InfluenceValues, config: InfluenceConfig = INFLUENCE_CONFIG): boolean {
  return evaluateInfluence('share', values, config).triggered;
}
