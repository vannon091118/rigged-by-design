/**
 * @test-target: src/core/sim/drink-menu.ts
 * @error-code: ERR-2001
 *
 * Die Karte ist eine Sicht auf Grundpreis und Barstufe. Geprueft werden die
 * Stufenfreigabe, die Preisreihenfolge, die deterministische Bestellung je
 * Persona, der echte Servierpfad ueber actAtTarget und der Grenzfall leerer Bar.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { deliverDrink } from '../deliveries';
import { drinkMenu, pickDrink } from '../drink-menu';
import { actAtTarget } from '../guest-play';
import { guestAccount, HAUSKONTO } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import type { Furniture, Guest, WorldState } from '../types';

function setup(seed = randomSeed()) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(2000), 'baukapital', 0);
  return { world, ledger, prng: new Prng(seed) };
}

const barOf = (world: WorldState): Furniture => world.furniture.find((item) => item.kind === 'BAR')!;

function thirsty(world: WorldState, prng: Prng, ledger: Ledger, thirst: number): { guest: Guest; bar: Furniture } {
  const guest = spawnGuest(world, prng, ledger)!;
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(50), 'test chips', 0);
  const bar = barOf(world);
  guest.state = 'DRINK';
  guest.targetFurniture = bar.id;
  guest.stateTicks = 0;
  guest.thirst = thirst;
  return { guest, bar };
}

describe('Getraenkekarte der Bar', () => {
  it('fuehrt auf Stufe 1 Spritz und Bier, Cocktail erst ab Stufe 3', () => {
    const { world } = setup();
    world.barLevel = 1;
    const sparsam = drinkMenu(world);
    expect(sparsam.map((drink) => drink.id)).toEqual(['SPRITZ', 'BIER']);
    expect(sparsam[0]!.price).toBe(world.prices.drinkPrice);
    expect(sparsam[1]!.price).toBeGreaterThan(sparsam[0]!.price);

    world.barLevel = 3;
    const voll = drinkMenu(world);
    expect(voll.map((drink) => drink.id)).toEqual(['SPRITZ', 'BIER', 'COCKTAIL']);
    expect(voll[2]!.price).toBeGreaterThan(voll[1]!.price);
    // Dieselbe Bar fuehrt dieselbe Karte: kein Wurf, kein Zeitstempel.
    expect(drinkMenu(world)).toEqual(voll);
    expect(voll.map((drink) => drink.moodGain)).toEqual([8, 10, 16]);
  });

  it('bestellt nach Durst und Persona, nicht nach Zufall', () => {
    const { world, prng, ledger } = setup(randomSeed());
    world.barLevel = 3;
    const menu = drinkMenu(world);

    const stammgast = { ...thirsty(world, prng, ledger, 10).guest, persona: 'STAMMGAST' as const };
    expect(pickDrink(menu, stammgast).id).toBe('COCKTAIL');
    expect(pickDrink(menu, stammgast).id).toBe('COCKTAIL');

    const highRoller = { ...thirsty(world, prng, ledger, 10).guest, persona: 'HIGH_ROLLER' as const };
    expect(pickDrink(menu, highRoller).id).toBe('SPRITZ');

    // Durst kann nur bestellen, was die Barstufe fuehrt: auf Stufe 1 kein Cocktail.
    world.barLevel = 1;
    const lumpen = { ...thirsty(world, prng, ledger, 95).guest, persona: 'LUMPEN' as const };
    expect(pickDrink(drinkMenu(world), lumpen).id).toBe('BIER');
  });

  it('serviert ueber den echten Spielpfad den Kartenpreis und verbraucht einen Bestand', () => {
    const { world, ledger, prng } = setup(randomSeed());
    world.barLevel = 3;
    const bar = barOf(world);
    bar.stock = 5;
    const { guest } = thirsty(world, prng, ledger, 95);
    const drink = pickDrink(drinkMenu(world), guest);
    const house = ledger.getBalance(HAUSKONTO);
    const wallet = ledger.getBalance(guestAccount(guest.id));

    actAtTarget(world, ledger, prng, guest, bar);

    expect(drink.id).toBe('COCKTAIL');
    expect(bar.stock).toBe(4);
    expect(ledger.getBalance(HAUSKONTO)).toBe(house + drink.price);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(wallet - drink.price);
    expect(guest.thirst).toBe(0);
    expect(guest.mood).toBeGreaterThanOrEqual(20);
  });

  it('verkauft an einer leeren Bar nichts und bucht nichts', () => {
    const { world, ledger, prng } = setup(randomSeed());
    const bar = barOf(world);
    bar.stock = 0;
    const { guest } = thirsty(world, prng, ledger, 90);
    const house = ledger.getBalance(HAUSKONTO);
    const mood = (guest.mood = 70);

    expect(deliverDrink(world, ledger, guest, bar)).toBe(false);
    expect(bar.stock).toBe(0);
    expect(ledger.getBalance(HAUSKONTO)).toBe(house);
    expect(guest.mood).toBeLessThan(mood);
  });

  it('bleibt ueber einen Ticklauf mit gleichem Seed vollstaendig gleich', () => {
    const run = (seed: number) => {
      const world = createWorld('SMALL');
      ensureStarter(world);
      const ledger = new Ledger();
      ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(2000), 'baukapital', 0);
      barOf(world).stock = 40;
      const prng = new Prng(seed);
      for (let index = 0; index < 400; index += 1) tickWorld(world, ledger, prng);
      return {
        menu: drinkMenu(world),
        stock: barOf(world).stock,
        house: ledger.getBalance(HAUSKONTO),
      };
    };
    const seed = randomSeed();
    const first = run(seed);
    const second = run(seed);

    expect(second).toEqual(first);
    expect(first.stock).toBeLessThanOrEqual(40);
    // Der Lauf bucht Ausgaben und Einnahmen; ein Hauskontostand auf dem
    // Startkapital ist keine Invariante. Die Determinismus-Pruefung oben und
    // ein nicht negativer Ledger-Stand sind es.
    expect(first.house).toBeGreaterThanOrEqual(0);
  });
});
