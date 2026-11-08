/**
 * Weitergabe als Matrix-Kontext: ob jemand ueberhaupt erzaehlt, haengt von
 * Laune, Geselligkeit, eigenem Geruecht und der Beziehung zum Empfaenger ab.
 * Vertrauen und Sympathie heben, Konflikt senkt ueber die Cross-Kante die
 * Geselligkeit - kein zweiter Schwellenwert neben der Matrix.
 */
import {
  INFLUENCE_CONFIG, evaluateInfluence,
  type InfluenceConfig, type InfluenceValues,
} from '../influence';

const SHARE_INFLUENCE_CONFIG: InfluenceConfig = {
  ...INFLUENCE_CONFIG,
  contexts: {
    ...INFLUENCE_CONFIG.contexts,
    share: {
      label: 'Weitergabe',
      weights: {
        mood: 0.2, sociability: 0.3, thirst: 0, rumor: 0.1,
        trust: 0.1, sympathy: 0.1, conflict: 0,
      },
      threshold: 0.38,
    },
  },
};

export function willingToShare(values: InfluenceValues, config: InfluenceConfig = SHARE_INFLUENCE_CONFIG): boolean {
  return evaluateInfluence('share', values, config).triggered;
}
