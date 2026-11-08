/**
 * Weitergabe als Matrix-Kontext: ob jemand ueberhaupt erzaehlt, haengt von
 * Laune, Geselligkeit und dem eigenen Geruecht ab - nicht von einem zweiten
 * Schwellenwert neben der Matrix. Die Basis bleibt `INFLUENCE_CONFIG`.
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
      // Wer niedergeschlagen und unfreundlich ist, behaelt sein Wissen fuer sich.
      weights: { mood: 0.3, sociability: 0.5, thirst: 0, rumor: 0.2 },
      threshold: 0.4,
    },
  },
};

export function willingToShare(values: InfluenceValues, config: InfluenceConfig = SHARE_INFLUENCE_CONFIG): boolean {
  return evaluateInfluence('share', values, config).triggered;
}
