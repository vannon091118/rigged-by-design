/** HUD-Texte: Labels, Ruf-Toene und Skill-Tipps als eigene Zustaendigkeit. */
import type { RpgAttribute } from '../core/sim/player-rpg';

export const PENALTY_LABEL = (kind: string): string =>
  kind === 'UNSAFE_REPUTATION' ? 'Unsicherer Ruf' : kind === 'MOOD_SHOCK' ? 'Stimmungsschock' : 'Ausgeraubt';

export const MOOD_LABEL = (mood: number): string => (mood >= 65 ? 'gut' : mood >= 40 ? 'gemischt' : 'gereizt');

/** Ruf als Farbe und Wort: eine Prozentzahl sagt niemandem etwas. */
export const reputationOf = (value: number): { readonly label: string; readonly tone: string } =>
  value >= 70 ? { label: 'angesehen', tone: 'ok' }
    : value >= 40 ? { label: 'solide', tone: '' }
      : { label: 'ramponiert', tone: 'warn' };

/**
 * Nur Kuerzel und Beschriftung: der Tooltip kommt aus der Karriere-Sicht
 * (`view.career.attributes`), damit HUD und Karrierefenster dieselbe
 * Effektbeschreibung lesen und kein UI-Text eigene Wirkungen verspricht.
 */
export const SKILLS: readonly (readonly [RpgAttribute, string])[] = [
  ['speed', 'SPD'],
  ['charisma', 'CHA'],
  ['brawl', 'BRW'],
  ['perception', 'PER'],
  ['technique', 'TEC'],
  ['endurance', 'END'],
  ['luck', 'LCK'],
];
