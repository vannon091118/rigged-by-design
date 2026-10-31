/** Duell: Der Spieler tritt gegen einen namentlichen Gegner aus dem Streit an. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { recordJournal } from './journal';
import { describeMugging, simulateMugging, type MuggingResult } from './mugging';
import { applyMoodShock, applyUnsafeReputation } from './penalty-pool';
import { grantXp } from './player-rpg';
import type { Dispute, Guest, PersonaId, WorldState } from './types';
import { guestById } from './world';

/** Gegnerprofil: sichtbar vor dem Kampf und wirksam in jeder Runde. */
interface DuelOpponent {
  readonly guestId: number;
  readonly name: string;
  readonly archetype: string;
  readonly strength: number;
  readonly greed: number;
  readonly nerve: number;
  readonly toughness: number;
}
export interface DuelPreview { readonly opponent: DuelOpponent; readonly winChance: number }
interface DuelResult {
  readonly outcome: 'WON' | 'LOST' | 'NONE';
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

const RATINGS: Record<PersonaId, Omit<DuelOpponent, 'guestId' | 'name'>> = {
  LUMPEN: { archetype: 'Lumpen-Schläger', strength: 3, greed: 6, nerve: 2, toughness: 3 },
  STREET: { archetype: 'Straßenschläger', strength: 5, greed: 6, nerve: 4, toughness: 5 },
  BUSINESS: { archetype: 'Betrüger', strength: 4, greed: 9, nerve: 5, toughness: 4 },
  HIGH_ROLLER: { archetype: 'Ringkämpfer', strength: 7, greed: 8, nerve: 6, toughness: 6 },
  STAMMGAST: { archetype: 'Stammgast', strength: 5, greed: 4, nerve: 3, toughness: 5 },
};

const rating = (value: number): number => Math.max(1, Math.min(10, Math.round(value)));
const heatOf = (guest: Guest): number => guest.anger + guest.addiction / 2;

/** Der wütendste Beteiligte ist der Rädelsführer und damit der Gegner. */
function instigator(world: WorldState, dispute: Dispute): Guest | null {
  let best: Guest | null = null;
  for (const id of dispute.guestIds) {
    const guest = guestById(world, id);
    if (guest && (!best || heatOf(guest) > heatOf(best))) best = guest;
  }
  return best;
}

/** Profil ohne PRNG, damit UI-Vorschau und Kampf garantiert denselben Gegner sehen. */
export function duelOpponent(world: WorldState, dispute: Dispute): DuelOpponent | null {
  const guest = instigator(world, dispute);
  if (!guest) return null;
  const base = RATINGS[guest.persona] ?? RATINGS.STREET;
  const heat = guest.anger / 50;
  const reckless = Math.max(0, (35 - guest.mood) / 25);
  return {
    guestId: guest.id, name: guest.name, archetype: base.archetype,
    strength: rating(base.strength + heat), greed: rating(base.greed + reckless),
    nerve: rating(base.nerve + guest.addiction / 40), toughness: rating(base.toughness + heat / 2),
  };
}

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
  return opponent ? { opponent, winChance: Math.round(seriesOdds(roundChance(world, opponent)) * 100) } : null;
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
