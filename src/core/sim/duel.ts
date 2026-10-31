/** Duell: Best-of-five gegen den Rädelsführer des Streits, inklusive Überfall-Folge. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { duelOpponent, inDuelRange, type DuelOpponent } from './duel-opponent';
import { recordJournal } from './journal';
import { describeMugging, simulateMugging, type MuggingResult } from './mugging';
import { applyMoodShock, applyUnsafeReputation } from './penalty-pool';
import { grantXp } from './player-rpg';
import type { Dispute, WorldState } from './types';
import { guestById } from './world';

export interface DuelPreview {
  readonly opponent: DuelOpponent;
  readonly winChance: number;
  readonly inRange: boolean;
}

interface DuelResult {
  readonly outcome: 'WON' | 'LOST' | 'NONE' | 'FAR';
  readonly opponent: DuelOpponent | null;
  readonly mugging: MuggingResult | null;
}

const XP_DUEL_WIN = 45;
const ROUNDS_TO_WIN = 3;
const PLAYER_BASE_ROUND = 52;
const ROUND_PER_LEVEL = 8;
const MOOD_BONUS = 12;
const MOOD_READY = 50;
const CROWD_MAX = 5;

/** Chance je Runde: Brawl-Stufe und Stimmung der Menge gegen Kraft und Zähigkeit. */
function roundChance(world: WorldState, opponent: DuelOpponent): number {
  const guests = world.guests.length;
  const averageMood = guests ? world.guests.reduce((sum, guest) => sum + guest.mood, 0) / guests : 0;
  const crowd = Math.max(-CROWD_MAX, Math.min(CROWD_MAX, (averageMood - MOOD_READY) / 10));
  const chance = PLAYER_BASE_ROUND + world.player.rpg.brawlLevel * ROUND_PER_LEVEL + crowd
    - opponent.strength * 3 - opponent.toughness * 2;
  return Math.max(5, Math.min(95, chance));
}

/** Best-of-five: die angezeigte Chance ist exakt die der simulierten Runden. */
function seriesOdds(perRound: number): number {
  const p = perRound / 100;
  const q = 1 - p;
  return 10 * p ** 3 * q ** 2 + 5 * p ** 4 * q + p ** 5;
}

export function duelPreview(world: WorldState, dispute: Dispute): DuelPreview | null {
  const opponent = duelOpponent(world, dispute);
  if (!opponent) return null;
  return {
    opponent,
    winChance: Math.round(seriesOdds(roundChance(world, opponent)) * 100),
    inRange: inDuelRange(world, dispute),
  };
}

/** Klartext der Meldung nach einem Duell-Versuch. */
export function duelNotice(result: DuelResult, event: string): string {
  if (result.outcome === 'NONE') return 'Kein Streit mehr da.';
  return result.outcome === 'FAR' ? 'Du stehst zu weit weg. Geh erst zum Streit.' : event;
}

function releaseDispute(world: WorldState, dispute: Dispute): void {
  world.disputes = world.disputes.filter((entry) => entry.id !== dispute.id);
  for (const id of dispute.guestIds) {
    const guest = guestById(world, id);
    if (!guest) continue;
    guest.disputeId = null;
    if (guest.state === 'ANGRY') { guest.state = 'CHOOSE'; guest.stateTicks = 0; }
  }
}

/**
 * Kämpft den Streit aus. Ein Sieg räumt den Rädelsführer beiseite; eine Niederlage
 * kostet Laune, bei eskaliertem Streit zusätzlich Ruf, und löst den Überfall aus.
 */
export function resolveDuel(world: WorldState, ledger: Ledger, prng: Prng, disputeId: number): DuelResult {
  const dispute = world.disputes.find((entry) => entry.id === disputeId);
  if (!dispute) return { outcome: 'NONE', opponent: null, mugging: null };
  const opponent = duelOpponent(world, dispute);
  if (!opponent) return { outcome: 'NONE', opponent: null, mugging: null };
  if (!inDuelRange(world, dispute)) return { outcome: 'FAR', opponent, mugging: null };
  const chance = roundChance(world, opponent);
  let playerRounds = 0;
  let rivalRounds = 0;
  while (playerRounds < ROUNDS_TO_WIN && rivalRounds < ROUNDS_TO_WIN) {
    if (rollNumber(prng, buildDistribution(1, 100)).value <= chance) playerRounds += 1;
    else rivalRounds += 1;
  }
  const won = playerRounds === ROUNDS_TO_WIN;
  releaseDispute(world, dispute);
  if (won) {
    for (const guest of world.guests) {
      if (dispute.guestIds.includes(guest.id)) continue;
      guest.mood = Math.min(100, guest.mood + MOOD_BONUS);
    }
    grantXp(world.player.rpg, XP_DUEL_WIN + opponent.strength * 2);
    recordJournal(world, {
      kind: 'GUEST', subject: `Duell gegen ${opponent.name}`,
      cause: `${opponent.archetype} fordert dich zu ${playerRounds}:${rivalRounds} Runden`,
      effect: `Gewonnen: ${opponent.name} fliegt raus, die Menge jubelt.`,
      refs: { guestId: opponent.guestId },
    });
    return { outcome: 'WON', opponent, mugging: null };
  }
  applyMoodShock(world);
  if (dispute.level >= 2) applyUnsafeReputation(world, 2 + (opponent.nerve > 6 ? 1 : 0));
  const mugging = simulateMugging(world, ledger, prng, opponent);
  recordJournal(world, {
    kind: 'GUEST', subject: `Duell gegen ${opponent.name}`,
    cause: `${opponent.archetype} gewinnt ${rivalRounds}:${playerRounds} Runden`,
    effect: `Verloren: ${describeMugging(mugging)}`,
    refs: { guestId: opponent.guestId },
  });
  return { outcome: 'LOST', opponent, mugging };
}
