/** Ein einzelner Gast: Profil, Fiat und Weg zur Kasse. Wie viele kommen, plant demand.ts. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { admitFiat } from './money';
import { MOOD_SHOCK_NEWCOMER_MALUS } from './penalty-pool';
import { attractionOf } from './offers';
import { makeGuest, randomFiat, randomPersona } from './traits';
import { markReturning, pickReturningVisitor, recordVisitor } from './visitors';
import type { Guest, WorldState } from './types';
import { exchangePoint, pathTo, spawnPoint } from './world';

/** 0..100: Ordnung, Zustand und Attraktion speisen eine Nachfragequelle, keine Sperre. */
export function reputation(world: WorldState): number {
  if (world.furniture.length === 0) return 0;
  const condition = world.furniture.reduce((sum, item) => sum + item.condition, 0) / world.furniture.length;
  const dirtPenalty = Math.min(40, world.dirty.size * 2.5);
  const staffBonus = (world.staff.cleaner ? 6 : 0) + (world.staff.bartender ? 5 : 0) + (world.staff.guard ? 4 : 0);
  const attraction = Math.min(30, attractionOf(world) / 260);
  return Math.max(0, Math.min(100, condition * 0.7 + staffBonus + attraction - dirtPenalty));
}

/** Keine Gaestezahl sperrt den Eingang; der Betrieb regelt den Andrang ueber Service und Laune. */
export function spawnGuest(world: WorldState, prng: Prng, ledger: Ledger): Guest | null {
  const id = world.nextGuestId++;
  const returning = pickReturningVisitor(world, id);
  const persona = returning ? returning.persona : randomPersona(prng, world.template);
  const spawn = spawnPoint(world);
  const fiat = randomFiat(prng, world.template, persona);
  const made = makeGuest({ id, persona, prng, spawn });
  const guest: Guest = returning
    ? { ...made, name: returning.name, visitorId: returning.id }
    : made;
  if (world.activePenalties.some((penalty) => penalty.kind === 'MOOD_SHOCK')) {
    guest.mood = Math.max(0, guest.mood - MOOD_SHOCK_NEWCOMER_MALUS);
  }
  const target = exchangePoint(world);
  if (!target) return null;
  if (returning) markReturning(returning, world.tick);
  else guest.visitorId = recordVisitor(world, { name: guest.name, persona, tick: world.tick }).id;
  admitFiat(ledger, id, fiat, world.tick);
  guest.targetZone = 'exchange';
  guest.path = pathTo(world, spawn, target);
  guest.pathIndex = 0;
  guest.queueIndex = world.guests.filter((entry) => entry.state === 'EXCHANGE').length;
  world.guests.push(guest);
  return guest;
}
