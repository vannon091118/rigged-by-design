/** Spieler-RPG: XP, Level und drei ausbaubare Attribute. Rein deterministisch, ohne Geldbewegung. */

export type RpgAttribute = 'speed' | 'charisma' | 'brawl';

export interface PlayerRpgState {
  level: number;
  xp: number;
  unspentPoints: number;
  speedLevel: number;
  charismaLevel: number;
  brawlLevel: number;
}

const XP_PER_LEVEL = 100;
/** Ab diesen Stufen laeuft der Spieler einen Pfadschritt mehr pro Tick. */
const SPEED_STEP_EVERY = 3;
const MAX_PLAYER_STEPS = 3;

export function newPlayerRpg(): PlayerRpgState {
  return { level: 1, xp: 0, unspentPoints: 0, speedLevel: 0, charismaLevel: 0, brawlLevel: 0 };
}

/** Schwelle bis zum naechsten Level; waechst linear, damit die Kurve planbar bleibt. */
function xpForNextLevel(level: number): number {
  return XP_PER_LEVEL * level;
}

/** Fuegt XP hinzu und hebt das Level so oft an, wie die Schwelle erreicht ist. */
export function grantXp(rpg: PlayerRpgState, amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) return;
  rpg.xp += amount;
  while (rpg.xp >= xpForNextLevel(rpg.level)) {
    rpg.xp -= xpForNextLevel(rpg.level);
    rpg.level += 1;
    rpg.unspentPoints += 1;
  }
}

/** Gibt einen Skillpunkt auf ein Attribut aus. Ohne freien Punkt passiert nichts. */
export function spendPoint(rpg: PlayerRpgState, attribute: RpgAttribute): boolean {
  if (rpg.unspentPoints <= 0) return false;
  rpg.unspentPoints -= 1;
  if (attribute === 'speed') rpg.speedLevel += 1;
  else if (attribute === 'charisma') rpg.charismaLevel += 1;
  else rpg.brawlLevel += 1;
  return true;
}

/**
 * Pfadschritte, die der Spieler pro Tick laeuft. Speed ist damit eine echte
 * Bewegungsgroesse und nicht nur ein gespeicherter Attributwert.
 */
export function playerStepsPerTick(rpg: PlayerRpgState): number {
  return Math.min(MAX_PLAYER_STEPS, 1 + Math.floor(Math.max(0, rpg.speedLevel) / SPEED_STEP_EVERY));
}
