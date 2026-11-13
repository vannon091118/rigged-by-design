/**
 * @test-target: src/core/sim/fight-bets.ts
 * @error-code: ERR-2001
 *
 * Der Markt darf nie besser sein als die Wahrscheinlichkeit, die er selbst
 * ansetzt, und er darf die Zuschauer nicht als Trefferpunkte lesen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { crowdBonus, fighters, winProbability } from '../brawl-combat';
import {
  BOOK_MARGIN, fightBetView, koProbability, marketQuotes, oddsFor, rpgOf, undercardPair,
} from '../fight-bets';
import { backyardView, fightChance, fightOpponentOf, fightRoster } from '../fight-career';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { openVenueEvent } from '../venue-event';

function setup(wallet = 20) {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(wallet), 'test startgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

/** Echter Saal statt Attrappe: Gaeste mit guter Laune geben den Hoechstbonus. */
function fillHouse(
  world: ReturnType<typeof setup>['world'], ledger: Ledger, prng: Prng, target: number,
): void {
  let attempts = 0;
  while (world.guests.length < target && attempts < target * 4) {
    const guest = spawnGuest(world, prng, ledger);
    if (guest) guest.mood = 100;
    attempts += 1;
  }
}

describe('Faire Quoten und ein Publikumswert', () => {
  it('zahlt nie mehr als die Marge und setzt fast sichere Ausgaenge aus', () => {
    for (const p of [0.01, 0.05, 0.2, 0.5, 0.7667, 0.8333, 0.9, 0.92]) {
      const price = oddsFor(p)!;
      expect(price).toBeGreaterThanOrEqual(1);
      expect(price).toBeLessThanOrEqual(6);
      expect(p * price - 1).toBeLessThanOrEqual(1e-9);
      expect(p * price).toBeLessThanOrEqual(BOOK_MARGIN + 1e-9);
    }
    // Der alte Floor 1.20 zahlte bei p = 1 noch 20 Prozent Gewinn.
    expect(oddsFor(0.5)).toBe(1.84);
    expect(oddsFor(0.999)).toBeNull();
    expect(oddsFor(1)).toBeNull();
  });

  it('kein Roster-Paar und keine Gaestezahl hat eine positive Wettseite', () => {
    const roster = fightRoster();
    const rooms: readonly (readonly { readonly mood: number }[])[] = [
      [],
      Array.from({ length: 20 }, () => ({ mood: 55 })),
      Array.from({ length: 40 }, () => ({ mood: 90 })),
    ];
    for (const guests of rooms) {
      const crowd = crowdBonus(guests);
      for (const a of roster) {
        for (const b of roster) {
          if (a.name === b.name) continue;
          const [left, right] = fighters(rpgOf(a), fightOpponentOf(b), crowd);
          const pA = winProbability(left, right);
          const pKo = koProbability(left, right);
          for (const p of [pA, 1 - pA, pKo, 1 - pKo]) {
            const price = oddsFor(p);
            if (price === null) continue;
            expect(p * price - 1).toBeLessThanOrEqual(1e-9);
            expect(p * price).toBeLessThanOrEqual(BOOK_MARGIN + 1e-9);
          }
        }
      }
    }
  });

  it('Markt und Vorkampf lesen crowdBonus, nicht die Gaestezahl', () => {
    const { world, ledger, prng } = setup();
    openVenueEvent(world, 'TURNIER_ABEND');
    world.tick = 730;
    fillHouse(world, ledger, prng, 10);
    expect(world.guests.length).toBeGreaterThanOrEqual(6);
    const market = fightBetView(world, ledger.getBalance(PORTEMONNAIE)).market!;
    const [a, b] = undercardPair(world)!;
    const quotes = marketQuotes(a, b, crowdBonus(world.guests));
    expect(market.odds).toEqual(quotes.odds);
    expect(market.odds.A!).toBeGreaterThanOrEqual(1);
    expect(market.chance).toBe(Math.round(quotes.pA * 100));
    // Die Zuschauerzahl als Prozentpunkte waere eine andere Chance.
    const asCount = marketQuotes(a, b, world.guests.length);
    expect(market.chance).not.toBe(Math.round(asCount.pA * 100));
  });

  it('Hinterhof-Anzeige und Hinterhofkampf teilen denselben Publikumswert', () => {
    const { world, ledger, prng } = setup();
    openVenueEvent(world, 'TURNIER_ABEND');
    world.tick = 730;
    fillHouse(world, ledger, prng, 10);
    const view = backyardView(world, ledger.getBalance(PORTEMONNAIE));
    const crowd = crowdBonus(world.guests);
    expect(crowd).toBeGreaterThan(0);
    expect(view.winChance).toBe(fightChance(world.player.rpg, view.rung, crowd));
    expect(view.winChance).not.toBe(fightChance(world.player.rpg, view.rung, 0));
  });
});
