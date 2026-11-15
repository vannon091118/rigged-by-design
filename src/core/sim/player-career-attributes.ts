/**
 * Spieler-Karriere: RPG-Attribute-Ansicht.
 *
 * Rendert die sieben RPG-Attribute mit Level und in-Spiel-Wirkung fuer das
 * Charakterfenster. Getrennt von player-career.ts (Hot Zone Budget).
 */

import type { WorldState } from './types';
import {
  playerStepsPerTick, playerMaxHp,
  type PlayerRpgState, type RpgAttribute,
} from './player-rpg';
import { cleaningReach, maintenanceGain } from './floor-work';

export interface CareerAttribute {
  readonly id: RpgAttribute;
  readonly label: string;
  readonly level: number;
  readonly effect: string;
}

const ACHIEVEMENT_LEVEL = 5;

/** Wirkung einer Stufe in Klartext; jede der sieben Stufen hat einen Leser im Spiel. */
export function effectOf(world: WorldState, attr: RpgAttribute): string {
  const rpg = world.player.rpg;
  if (attr === 'speed') return `${playerStepsPerTick(rpg)} Schritte pro Tick`;
  if (attr === 'perception') return `Reinigung im Radius ${cleaningReach(world)}`;
  if (attr === 'technique') return `Wartung +${maintenanceGain(world)} Zustandspunkte`;
  if (attr === 'charisma') return `${40 + rpg.charismaLevel * 10} % Ansprech-Chance`;
  if (attr === 'brawl') return `${6 + rpg.brawlLevel * 2} Schaden · ${playerMaxHp(rpg)} LP`;
  if (attr === 'endurance') return `Regeneration alle ${Math.max(2, 4 - Math.floor(rpg.enduranceLevel / 5))} Ticks`;
  return `Unfallrisiko -${Math.min(75, rpg.luckLevel * 5)} %`;
}

export const ATTRIBUTE_LABELS: readonly (readonly [RpgAttribute, string])[] = [
  ['speed', 'Speed'],
  ['charisma', 'Charisma'],
  ['brawl', 'Brawl'],
  ['perception', 'Wahrnehmung'],
  ['technique', 'Technik'],
  ['endurance', 'Ausdauer'],
  ['luck', 'Glück'],
];

function levelOf(rpg: PlayerRpgState, attr: RpgAttribute): number {
  if (attr === 'speed') return rpg.speedLevel;
  if (attr === 'charisma') return rpg.charismaLevel;
  if (attr === 'brawl') return rpg.brawlLevel;
  if (attr === 'perception') return rpg.perceptionLevel;
  if (attr === 'technique') return rpg.techniqueLevel;
  if (attr === 'endurance') return rpg.enduranceLevel;
  return rpg.luckLevel;
}

/** Alle sieben RPG-Attribute als Karriere-Ansicht. */
export function careerAttributes(world: WorldState): readonly CareerAttribute[] {
  const rpg = world.player.rpg;
  return ATTRIBUTE_LABELS.map(([id, label]) => ({
    id, label, level: levelOf(rpg, id), effect: effectOf(world, id),
  }));
}

export { ACHIEVEMENT_LEVEL };
