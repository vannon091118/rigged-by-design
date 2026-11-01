/** Ein einzelner Gast: Profil, Fiat und Weg zur Kasse. Wie viele kommen, plant demand.ts. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { admitFiat } from './money';
import { MOOD_SHOCK_NEWCOMER_MALUS } from './penalty-pool';
import { attractionOf } from './offers';
import { makeGuest, personaTier, randomFiat, randomPersona } from './traits';
import { markReturning, pickReturningVisitor, recordVisitor } from './visitors';
import { emitFact } from './narrative/facts';
import { memoryEffect, processFacts } from './narrative/memory';
import { hasStaff } from './staff-queries';
import type { Guest, WorldState } from './types';
import { entranceSpot, exchangePoint, pathTo } from './world';

/**
 * 0..100: Ruf entsteht aus dem, was Gaeste erlebt haben. Ein frischer Automat in gutem
 * Zustand ist noch kein Ruf; erst bediente Gaeste, Ausstattung und Service bauen ihn auf.
 * Das ist eine Nachfragequelle, keine Sperre.
 */
export function reputation(world: WorldState): number {
  const games = world.furniture.filter((item) => item.gameId);
  if (games.length === 0) return 0;
  const condition = games.reduce((sum, item) => sum + item.condition, 0) / games.length / 100;
  const quality = games.reduce((sum, item) => sum + item.quality, 0) / games.length;
  // Ein einzelner Automat traegt noch keinen Ruf; der Faktor waechst mit dem Angebot.
  const scale = Math.min(1, games.length / 8);
  const served = 22 * (1 - Math.exp(-world.guestsServed / 80));
  const experience = Math.max(-14, Math.min(14, (world.satisfaction - 55) * 0.35));
  const staff = (world.staff.cleaner ? 3 : 0) + (world.staff.bartender ? 3 : 0)
    + (world.staff.cashier ? 2 : 0) + (hasStaff(world, 'guard') ? 2 : 0) + (world.staff.porter ? 1 : 0);
  const dirt = Math.min(10, world.dirty.size * 0.8);
  const attraction = Math.min(8, attractionOf(world) / 150);
  const value = 5 + served + condition * 15 * scale + (quality - 1) * 16 * scale
    + experience + staff + attraction - dirt;
  return Math.max(0, Math.min(100, value));
}

/** Keine Gaestezahl sperrt den Eingang; der Betrieb regelt den Andrang ueber Service und Laune. */
export function spawnGuest(world: WorldState, prng: Prng, ledger: Ledger): Guest | null {
  const id = world.nextGuestId++;
  const returning = pickReturningVisitor(world, id);
  const persona = returning ? returning.persona : randomPersona(prng, personaTier(world.demandTier));
  const spawn = entranceSpot(world, id);
  const fiat = randomFiat(prng, world.template, persona);
  const made = makeGuest({ id, persona, prng, spawn });
  const guest: Guest = returning
    ? { ...made, name: returning.name, visitorId: returning.id, mood: Math.max(0, Math.min(100, made.mood + memoryEffect(returning).moodBonus)) }
    : made;
  if (world.activePenalties.some((penalty) => penalty.kind === 'MOOD_SHOCK')) {
    guest.mood = Math.max(0, guest.mood - MOOD_SHOCK_NEWCOMER_MALUS);
  }
  const target = exchangePoint(world);
  if (!target) return null;
  if (returning) {
    markReturning(returning, world.tick);
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: returning.id, visits: returning.visits });
  } else {
    guest.visitorId = recordVisitor(world, { name: guest.name, persona, tick: world.tick }).id;
    emitFact(world, { kind: 'VISITOR_FIRST_SEEN', visitorId: guest.visitorId, persona });
  }
  processFacts(world);
  admitFiat(ledger, id, fiat, world.tick);
  guest.targetZone = 'exchange';
  guest.path = pathTo(world, spawn, target);
  guest.pathIndex = 0;
  // Warteschlange an der Kasse: wer noch hereinkommt, reiht sich hinten ein.
  guest.queueIndex = world.guests.filter((entry) => entry.state === 'EXCHANGE' || entry.state === 'ENTER').length;
  world.guests.push(guest);
  return guest;
}
