/** Spieler-RPG: XP, Level, drei ausbaubare Attribute und der Kampfkoerper. Rein deterministisch, ohne Geldbewegung. */

export type RpgAttribute = 'speed' | 'charisma' | 'brawl';

export interface PlayerRpgState {
  level: number;
  xp: number;
  unspentPoints: number;
  speedLevel: number;
  charismaLevel: number;
  brawlLevel: number;
  /** Lebenspunkte im aktuellen Zustand; gedeckelt durch `playerMaxHp`. */
  hp: number;
  /** Restticks einer Verletzung; 0 ist gesund. */
  injuryTicks: number;
}

const XP_PER_LEVEL = 100;
/** Ab diesen Stufen laeuft der Spieler einen Pfadschritt mehr pro Tick. */
const SPEED_STEP_EVERY = 3;
const MAX_PLAYER_STEPS = 3;
/** Grundkondition; jede Brawl-Stufe bringt sechs weitere Lebenspunkte. */
const BASE_HP = 60;
const HP_PER_BRAWL = 6;
/** Eine Verletzung haelt ein Fuenftel Spieltag und bremst Laufen und Kampf. */
export const INJURY_TICKS = 120;
/** Lebenspunkte fallen alle vier Ticks zurueck, nicht auf einmal. */
const RECOVER_EVERY = 4;

export function newPlayerRpg(): PlayerRpgState {
  return {
    level: 1, xp: 0, unspentPoints: 0, speedLevel: 0, charismaLevel: 0, brawlLevel: 0,
    hp: BASE_HP, injuryTicks: 0,
  };
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

/** Hoechstes erreichbarer Lebenspunktestand dieser Stufe. */
export function playerMaxHp(rpg: PlayerRpgState): number {
  return BASE_HP + Math.max(0, rpg.brawlLevel) * HP_PER_BRAWL;
}

/** Gelesene Lebenspunkte: verwundet darf der Spieler werden, aber nie tot. */
export function playerHp(rpg: PlayerRpgState): number {
  return Math.max(1, Math.min(rpg.hp, playerMaxHp(rpg)));
}

export function isInjured(rpg: PlayerRpgState): boolean {
  return rpg.injuryTicks > 0;
}

/** Verletzung heilt mit der Welt, Lebenspunkte füllen sich stufenweise auf. */
export function recoverPlayer(rpg: PlayerRpgState, tick: number): void {
  if (rpg.injuryTicks > 0) rpg.injuryTicks -= 1;
  const max = playerMaxHp(rpg);
  if (tick % RECOVER_EVERY === 0 && rpg.hp < max) rpg.hp = Math.min(max, rpg.hp + 1);
}

/**
 * Pfadschritte, die der Spieler pro Tick laeuft. Speed ist damit eine echte
 * Bewegungsgroesse und nicht nur ein gespeicherter Attributwert. Wer verletzt
 * ist, verliert einen Schritt – die Verletzung wirkt auf den Koerper, nicht
 * auf die Simulationsuhr.
 */
export function playerStepsPerTick(rpg: PlayerRpgState): number {
  const steps = Math.min(MAX_PLAYER_STEPS, 1 + Math.floor(Math.max(0, rpg.speedLevel) / SPEED_STEP_EVERY));
  return isInjured(rpg) ? Math.max(1, steps - 1) : steps;
}
