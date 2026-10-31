/** Spielerkampf: Lebenspunkte, Trefferchancen und Runden, deren Anzeige exakt aus der Mechanik kommt. */
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import type { DuelOpponent } from './duel-opponent';
import { INJURY_TICKS, playerHp, playerMaxHp, type PlayerRpgState } from './player-rpg';

interface Fighter {
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
  /** Lebenspunkte, die ein Treffer abzieht. */
  readonly attack: number;
  /** Trefferquote in Prozent, aus derselben Verteilung wie der Wurf. */
  readonly hit: number;
}

export interface FightResult {
  readonly playerWon: boolean;
  readonly rounds: number;
  readonly playerHp: number;
  readonly opponentHp: number;
  /** Die letzten Runden als Klartext,aelteste zuerst. */
  readonly log: readonly string[];
}

const MIN_HIT = 15;
const MAX_HIT = 95;
const BASE_OPPONENT_HP = 34;
const HP_PER_TOUGHNESS = 7;
const LOG_LIMIT = 6;
/** Nur ein Notfallnetz: statistisch faellt hier niemand mehr um. */
const MAX_ROUNDS = 200;

const clamp = (value: number): number => Math.max(MIN_HIT, Math.min(MAX_HIT, Math.round(value)));

/** Einmal gebaut, immer wieder gewuerfelt: dieselbe 1..100-Verteilung, die die Anzeige als Chance angibt. */
const HIT_DISTRIBUTION = buildDistribution(1, 100);

function hits(prng: Prng, chance: number): boolean {
  return rollNumber(prng, HIT_DISTRIBUTION).value <= chance;
}

/**
 * Beide Kaempfer aus derselben Lage: Brawl-Stufe traegt Angriff, Treffer und
 * Lebenspunkte, das Gegnerprofil traegt Kraft und Zaehigkeit, die Menge liefert
 * den Stimmungsbonus. Die Vorschau liest genau diese Werte.
 */
export function fighters(rpg: PlayerRpgState, opponent: DuelOpponent, crowd: number): [Fighter, Fighter] {
  const player: Fighter = {
    name: 'Du',
    hp: playerHp(rpg),
    maxHp: playerMaxHp(rpg),
    attack: 6 + rpg.brawlLevel * 2,
    hit: clamp(55 + rpg.brawlLevel * 3 + crowd - opponent.strength),
  };
  const rival: Fighter = {
    name: opponent.name,
    hp: BASE_OPPONENT_HP + opponent.toughness * HP_PER_TOUGHNESS,
    maxHp: BASE_OPPONENT_HP + opponent.toughness * HP_PER_TOUGHNESS,
    attack: 5 + opponent.strength * 2,
    hit: clamp(52 + opponent.strength * 2 - rpg.brawlLevel * 2 - Math.round(crowd / 2)),
  };
  return [player, rival];
}

/**
 * Gewinnwahrscheinlichkeit aus genau der Mechanik des gefuehrten Kampfes:
 * abwechselnd Treffer bis jemand umfaellt. Beide verfehlen in derselben Runde
 * und landen wieder derselben Lage – dieser eine Kreis wird analytisch
 * aufgeloest, alle uebrigen Zustände sind streng kleiner. Das Ergebnis ist
 * dadurch exakt und nicht geschaetzt.
 */
export function winProbability(player: Fighter, opponent: Fighter): number {
  const memo = new Map<number, number>();
  const pHit = player.hit / 100;
  const oHit = opponent.hit / 100;
  const loop = (1 - pHit) * (1 - oHit);

  const solve = (php: number, ohp: number): number => {
    const id = php * 8192 + ohp;
    const known = memo.get(id);
    if (known !== undefined) return known;
    const afterPlayer = Math.max(0, ohp - player.attack);
    let fresh: number;
    if (afterPlayer === 0) {
      fresh = pHit;
    } else {
      const counter = Math.max(0, php - opponent.attack);
      const struck = counter === 0 ? 0 : oHit * solve(counter, afterPlayer);
      fresh = pHit * (struck + (1 - oHit) * solve(php, afterPlayer));
    }
    const survived = Math.max(0, php - opponent.attack);
    if (survived > 0) fresh += (1 - pHit) * oHit * solve(survived, ohp);
    const value = fresh / (1 - loop);
    memo.set(id, value);
    return value;
  };

  return solve(Math.max(1, player.hp), Math.max(1, opponent.hp));
}

/** Fuehrt den Kampf Runde fuer Runde und merkt sich die fuer die Folge nachvollziehbaren Schlaege. */
export function simulateFight(player: Fighter, opponent: Fighter, prng: Prng): FightResult {
  let php = Math.max(1, player.hp);
  let ohp = Math.max(1, opponent.hp);
  let rounds = 0;
  const lines: string[] = [];
  while (php > 0 && ohp > 0 && rounds < MAX_ROUNDS) {
    rounds += 1;
    if (hits(prng, player.hit)) {
      ohp = Math.max(0, ohp - player.attack);
      lines.push(`R${rounds}: du triffst ${opponent.name} (-${player.attack} LP, noch ${ohp})`);
      if (ohp === 0) break;
    }
    if (hits(prng, opponent.hit)) {
      php = Math.max(0, php - opponent.attack);
      lines.push(`R${rounds}: ${opponent.name} trifft dich (-${opponent.attack} LP, noch ${php})`);
    }
  }
  const playerWon = ohp === 0
    || (php > 0 && php / player.maxHp > ohp / opponent.maxHp);
  return {
    playerWon,
    rounds,
    playerHp: php,
    opponentHp: ohp,
    log: lines.slice(-LOG_LIMIT),
  };
}

/** Kampffolge fuer den Koerper: KO kostet eine volle Verletzung, ein knapper Sieg die halbe. */
export function applyFightOutcome(rpg: PlayerRpgState, fight: FightResult, maxHp: number): void {
  rpg.hp = Math.max(1, Math.min(maxHp, fight.playerHp));
  if (!fight.playerWon) rpg.injuryTicks = INJURY_TICKS;
  else if (fight.playerHp * 2 <= maxHp) rpg.injuryTicks = Math.round(INJURY_TICKS / 2);
}
