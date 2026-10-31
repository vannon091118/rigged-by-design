/** Duell: ein echter Kampf mit Lebenspunkten gegen den Rädelsführer des Streits, inklusive Überfall-Folge. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import {
  applyFightOutcome, fighters, simulateFight, winProbability, type FightResult,
} from './brawl-combat';
import { guardHandling } from './disputes';
import { duelOpponent, inDuelRange, type DuelOpponent } from './duel-opponent';
import { recordJournal } from './journal';
import { describeMugging, simulateMugging, type MuggingResult } from './mugging';
import { applyMoodShock, applyUnsafeReputation } from './penalty-pool';
import { grantXp, isInjured } from './player-rpg';
import type { Dispute, WorldState } from './types';
import { guestById } from './world';

export interface DuelPreview {
  readonly opponent: DuelOpponent;
  /** Siegwahrscheinlichkeit in Prozent, exakt aus der gefuehrten Mechanik. */
  readonly winChance: number;
  readonly inRange: boolean;
  /** Der eigene Koerper vor dem Schlag: was die Anzeige sagt, ist auch im Kampf wirksam. */
  readonly player: { readonly hp: number; readonly maxHp: number; readonly injured: boolean };
  readonly opponentHp: number;
}

interface DuelResult {
  readonly outcome: 'WON' | 'LOST' | 'NONE' | 'FAR' | 'GUARD';
  readonly opponent: DuelOpponent | null;
  readonly mugging: MuggingResult | null;
  readonly fight: FightResult | null;
}

const XP_DUEL_WIN = 45;
const MOOD_BONUS = 12;
const MOOD_READY = 50;
const CROWD_MAX = 5;

/** Die Menge jubelt oder schimpft: -5..+5 Prozentpunkte Trefferquote. */
function crowdBonus(world: WorldState): number {
  const guests = world.guests.length;
  const averageMood = guests ? world.guests.reduce((sum, guest) => sum + guest.mood, 0) / guests : 0;
  return Math.max(-CROWD_MAX, Math.min(CROWD_MAX, (averageMood - MOOD_READY) / 10));
}

export function duelPreview(world: WorldState, dispute: Dispute): DuelPreview | null {
  const opponent = duelOpponent(world, dispute);
  if (!opponent) return null;
  const [player, rival] = fighters(world.player.rpg, opponent, crowdBonus(world));
  return {
    opponent,
    winChance: Math.round(winProbability(player, rival) * 100),
    inRange: inDuelRange(world, dispute),
    player: { hp: player.hp, maxHp: player.maxHp, injured: isInjured(world.player.rpg) },
    opponentHp: rival.hp,
  };
}

/** Klartext der Meldung nach einem Duell-Versuch. */
export function duelNotice(result: DuelResult, event: string): string {
  if (result.outcome === 'NONE') return 'Kein Streit mehr da.';
  if (result.outcome === 'FAR') return 'Du stehst zu weit weg. Geh erst zum Streit.';
  if (result.outcome === 'GUARD') return 'Der Security ist bereits vor Ort und bearbeitet den Streit.';
  return event;
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
 * Kaempft den Streit aus. Ein Sieg raeumt den Raedelsführer beiseite; eine
 * Niederlage kostet Laune, hinterlaesst eine Verletzung und loest den Ueberfall
 * aus. Beide Seiten stehen sich mit denselben Lebenspunkten gegenueber, die
 * auch die Vorschau anzeigt.
 */
export function resolveDuel(world: WorldState, ledger: Ledger, prng: Prng, disputeId: number): DuelResult {
  const dispute = world.disputes.find((entry) => entry.id === disputeId);
  if (!dispute) return { outcome: 'NONE', opponent: null, mugging: null, fight: null };
  const opponent = duelOpponent(world, dispute);
  if (!opponent) return { outcome: 'NONE', opponent: null, mugging: null, fight: null };
  if (guardHandling(world, dispute)) return { outcome: 'GUARD', opponent, mugging: null, fight: null };
  if (!inDuelRange(world, dispute)) return { outcome: 'FAR', opponent, mugging: null, fight: null };

  const [player, rival] = fighters(world.player.rpg, opponent, crowdBonus(world));
  const fight = simulateFight(player, rival, prng);
  applyFightOutcome(world.player.rpg, fight, player.maxHp);
  releaseDispute(world, dispute);
  const rounds = `${fight.rounds} Runden · du ${world.player.rpg.hp}/${player.maxHp} LP · ${opponent.name} ${fight.opponentHp} LP`;

  if (fight.playerWon) {
    for (const guest of world.guests) {
      if (dispute.guestIds.includes(guest.id)) continue;
      guest.mood = Math.min(100, guest.mood + MOOD_BONUS);
    }
    grantXp(world.player.rpg, XP_DUEL_WIN + opponent.strength * 2);
    world.lastEvent = `Gewonnen gegen ${opponent.name} nach ${fight.rounds} Runden. Du hast noch ${world.player.rpg.hp} LP.`;
    recordJournal(world, {
      kind: 'GUEST', subject: `Duell gegen ${opponent.name}`,
      cause: `${opponent.archetype} fordert dich · ${rounds}`,
      effect: 'Gewonnen: der Rädelsführer ist raus, die Menge jubelt.',
      refs: { guestId: opponent.guestId },
    });
    return { outcome: 'WON', opponent, mugging: null, fight };
  }
  applyMoodShock(world);
  if (dispute.level >= 2) applyUnsafeReputation(world, 2 + (opponent.nerve > 6 ? 1 : 0));
  const mugging = simulateMugging(world, ledger, prng, opponent);
  world.lastEvent = `Verloren gegen ${opponent.name} nach ${fight.rounds} Runden. Du bist verletzt.`;
  recordJournal(world, {
    kind: 'GUEST', subject: `Duell gegen ${opponent.name}`,
    cause: `${opponent.archetype} gewinnt · ${rounds}`,
    effect: `Verloren: ${describeMugging(mugging)}`,
    refs: { guestId: opponent.guestId },
  });
  return { outcome: 'LOST', opponent, mugging, fight };
}
