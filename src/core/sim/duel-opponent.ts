/** Gegnerprofil eines Streits: abgeleitet, ohne PRNG, damit Vorschau und Kampf gleich sehen. */
import type { Dispute, Guest, PersonaId, WorldState } from './types';
import { guestById } from './world';

/** Gegnerprofil: sichtbar vor dem Kampf und wirksam in jeder Runde. */
export interface DuelOpponent {
  readonly guestId: number;
  readonly name: string;
  readonly archetype: string;
  readonly strength: number;
  readonly greed: number;
  readonly nerve: number;
  readonly toughness: number;
}

/** Wie beim Schlichten: nur wer am Streit steht, kann eingreifen. */
const DUEL_RANGE = 4;

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

export function inDuelRange(world: WorldState, dispute: Dispute): boolean {
  const distance = Math.abs(world.player.position.x - dispute.x) + Math.abs(world.player.position.y - dispute.y);
  return distance <= DUEL_RANGE;
}
