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

export const SKILLS: readonly (readonly [RpgAttribute, string, string])[] = [
  ['speed', 'SPD', 'Speed: mehr Pfadschritte pro Tick, bessere Queue-Position.'],
  ['charisma', 'CHA', 'Charisma: bessere Talk-Chance, mehr Trinkgeld.'],
  ['brawl', 'BRW', 'Brawl: mehr HP, mehr Kampfschaden.'],
  ['perception', 'PER', 'Wahrnehmung: bessere Queue-Position, Dreck früher sehen.'],
  ['technique', 'TEC', 'Technik: schnellere Reparatur, bessere Mods.'],
  ['endurance', 'END', 'Ausdauer: schnellere Regeneration, kürzere Verletzungen.'],
  ['luck', 'LCK', 'Glück: RNG-Bias bei Spielen, höhere Jackpot-Chance.'],
];
