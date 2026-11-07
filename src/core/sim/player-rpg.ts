/** Spieler-RPG: 7 Attribute, Level, XP und Kampfkoerper. Rein deterministisch, ohne Geldbewegung. */

export type RpgAttribute = 'speed' | 'charisma' | 'brawl' | 'perception' | 'technique' | 'endurance' | 'luck';

export interface PlayerRpgState {
  level: number; xp: number; unspentPoints: number;
  speedLevel: number; charismaLevel: number; brawlLevel: number;
  perceptionLevel: number; techniqueLevel: number; enduranceLevel: number; luckLevel: number;
  attributeXp: Partial<Record<RpgAttribute, number>>;
  hp: number; injuryTicks: number;
}

const XP_PER_LEVEL = 100;
const SPEED_STEP_EVERY = 3;
const MAX_PLAYER_STEPS = 3;
const BASE_HP = 60;
const HP_PER_BRAWL = 6;
const HP_PER_ENDURANCE = 1;
export const INJURY_TICKS = 120;
const ATTRIBUTE_XP_PER_LEVEL = 100;

export function newPlayerRpg(): PlayerRpgState {
  return {
    level: 1, xp: 0, unspentPoints: 0, speedLevel: 0, charismaLevel: 0, brawlLevel: 0,
    perceptionLevel: 0, techniqueLevel: 0, enduranceLevel: 0, luckLevel: 0,
    attributeXp: {}, hp: BASE_HP, injuryTicks: 0,
  };
}

function xpForNextLevel(level: number): number { return XP_PER_LEVEL * level; }

export function grantXp(rpg: PlayerRpgState, amount: number): void {
  grantGlobalXp(rpg, 'generic', amount);
}

export function grantGlobalXp(rpg: PlayerRpgState, sourceKey: string, amount: number, multiplier = 1): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) return;
  const totalXp = Math.round(amount * multiplier);
  rpg.xp += totalXp;
  while (rpg.xp >= xpForNextLevel(rpg.level)) {
    rpg.xp -= xpForNextLevel(rpg.level); rpg.level += 1; rpg.unspentPoints += 1;
  }
  const weights = XP_SOURCE_WEIGHTS[sourceKey];
  if (weights) {
    for (const [attr, weight] of Object.entries(weights)) {
      const key = attr as RpgAttribute;
      let next = (rpg.attributeXp[key] ?? 0) + Math.round(totalXp * weight);
      while (next >= ATTRIBUTE_XP_PER_LEVEL) {
        next -= ATTRIBUTE_XP_PER_LEVEL;
        incrementAttribute(rpg, key);
      }
      rpg.attributeXp[key] = next;
    }
  }
}

function incrementAttribute(rpg: PlayerRpgState, attr: RpgAttribute): void {
  if (attr === 'speed') rpg.speedLevel += 1;
  else if (attr === 'charisma') rpg.charismaLevel += 1;
  else if (attr === 'brawl') rpg.brawlLevel += 1;
  else if (attr === 'perception') rpg.perceptionLevel += 1;
  else if (attr === 'technique') rpg.techniqueLevel += 1;
  else if (attr === 'endurance') rpg.enduranceLevel += 1;
  else if (attr === 'luck') rpg.luckLevel += 1;
  if (attr === 'brawl' || attr === 'endurance') {
    rpg.hp = Math.min(playerMaxHp(rpg), rpg.hp + 2);
  }
}

export function spendPoint(rpg: PlayerRpgState, attribute: RpgAttribute): boolean {
  if (rpg.unspentPoints <= 0) return false;
  rpg.unspentPoints -= 1; incrementAttribute(rpg, attribute); return true;
}

export function playerMaxHp(rpg: PlayerRpgState): number {
  return BASE_HP + Math.max(0, rpg.brawlLevel) * HP_PER_BRAWL + Math.max(0, rpg.enduranceLevel) * HP_PER_ENDURANCE;
}

export function playerHp(rpg: PlayerRpgState): number {
  return Math.max(1, Math.min(rpg.hp, playerMaxHp(rpg)));
}

export function isInjured(rpg: PlayerRpgState): boolean { return rpg.injuryTicks > 0; }

export function recoverPlayer(rpg: PlayerRpgState, tick: number): void {
  if (rpg.injuryTicks > 0) rpg.injuryTicks -= 1;
  const max = playerMaxHp(rpg);
  const every = Math.max(2, 4 - Math.floor(rpg.enduranceLevel / 5));
  if (tick % every === 0 && rpg.hp < max) rpg.hp = Math.min(max, rpg.hp + 1);
}

export function playerStepsPerTick(rpg: PlayerRpgState): number {
  const steps = Math.min(MAX_PLAYER_STEPS, 1 + Math.floor(Math.max(0, rpg.speedLevel) / SPEED_STEP_EVERY));
  return isInjured(rpg) ? Math.max(1, steps - 1) : steps;
}

export function injuryDurationReduction(rpg: PlayerRpgState): number {
  return Math.floor(Math.max(0, rpg.enduranceLevel) / 3);
}

const XP_SOURCE_WEIGHTS: Readonly<Record<string, Partial<Record<RpgAttribute, number>>>> = {
  JOB_CLEANER: { speed: 0.3, perception: 0.4, endurance: 0.3 },
  JOB_BARTENDER: { charisma: 0.4, brawl: 0.2, perception: 0.2, endurance: 0.2 },
  JOB_CARD_DEALER: { speed: 0.3, technique: 0.4, luck: 0.1, perception: 0.2 },
  JOB_MECHANIC: { technique: 0.4, brawl: 0.2, endurance: 0.2, perception: 0.2 },
  SERVE_DRINK: { charisma: 0.5, speed: 0.2, perception: 0.3 },
  REPAIR_MACHINE: { technique: 0.6, endurance: 0.2, perception: 0.2 },
  CLEAN_FLOOR: { perception: 0.5, speed: 0.3, endurance: 0.2 },
  CALM_DISPUTE: { charisma: 0.3, brawl: 0.3, perception: 0.4 },
  WIN_BRAWL: { brawl: 0.5, endurance: 0.3, speed: 0.2 },
  FOREIGN_PLAY: { luck: 0.5, technique: 0.3, perception: 0.2 },
  RISK_CARD_WIN: { luck: 0.6, technique: 0.2, endurance: 0.2 },
  FOREIGN_JACKPOT: { luck: 0.8, technique: 0.2 },
  TALK_SUCCESS: { charisma: 0.7, perception: 0.3 },
  TALK_BACKFIRE: { endurance: 0.5, charisma: 0.3, brawl: 0.2 },
  generic: {},
};
