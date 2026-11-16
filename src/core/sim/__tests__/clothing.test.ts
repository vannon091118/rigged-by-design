/**
 * @test-target: src/core/sim/clothing.ts
 * @error-code: ERR-2001
 *
 * Kleidung ist ein Inventar mit Preis: gekauft wird aus dem Portemonnaie ueber
 * den Ledger, getragen wird je ein Outfit und ein Accessoire, und das Auftreten
 * verschiebt die Ansprechchance nur gedeckelt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { buyClothing, clothingView, normalizeClothing, styleBonus, wearClothing } from '../clothing';
import { talkChance } from '../charisma-talk';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';

function setup(walletVC = 2000) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(walletVC), 'test startgeld', 0);
  return { world, ledger };
}

describe('Kleiderschrank: Kauf ueber den Ledger', () => {
  it('bucht den Preis aus dem Portemonnaie und legt das Stueck in den Besitz', () => {
    const { world, ledger } = setup();
    const before = ledger.getBalance(PORTEMONNAIE);

    const notice = buyClothing(world, ledger, 'JACKE_DESIGNER', 0);

    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - fromVC(900));
    expect(world.player.clothing.owned).toEqual(['JACKE_DESIGNER']);
    expect(notice).toContain('900 VC');
    const booking = ledger.entries.find((entry) => entry.reason === 'kleidung')!;
    expect(booking.from).toBe(PORTEMONNAIE);
    expect(booking.to).toBe(EXTERNAL);
    expect(booking.amount).toBe(fromVC(900));
  });

  it('verweigert den Kauf ohne Geld und den zweiten Kauf desselben Stuecks', () => {
    const poor = setup(100);
    expect(() => buyClothing(poor.world, poor.ledger, 'JACKE_DESIGNER', 0)).toThrow(/Nicht genug Bargeld/);
    expect(poor.ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(100));
    expect(poor.world.player.clothing.owned).toEqual([]);

    const rich = setup();
    buyClothing(rich.world, rich.ledger, 'CAP_LOGO', 0);
    expect(() => buyClothing(rich.world, rich.ledger, 'CAP_LOGO', 0)).toThrow(/bereits/);
  });
});

describe('Kleiderschrank: tragen und ablegen', () => {
  it('haelt je Kategorie einen Slot und legt beim zweiten Klick wieder ab', () => {
    const { world, ledger } = setup();
    buyClothing(world, ledger, 'JACKE_DESIGNER', 0);
    buyClothing(world, ledger, 'KETTE_GOLD', 0);

    wearClothing(world, 'JACKE_DESIGNER');
    wearClothing(world, 'KETTE_GOLD');
    expect(world.player.clothing.wornOutfit).toBe('JACKE_DESIGNER');
    expect(world.player.clothing.wornAccessory).toBe('KETTE_GOLD');
    expect(styleBonus(world)).toBe(10);
    expect(clothingView(world).items.filter((item) => item.worn)).toHaveLength(2);

    wearClothing(world, 'JACKE_DESIGNER');
    expect(world.player.clothing.wornOutfit).toBeNull();
    expect(styleBonus(world)).toBe(4);
  });

  it('verweigert das Tragen eines fremden Stuecks', () => {
    const { world } = setup();
    expect(() => wearClothing(world, 'JACKE_DESIGNER')).toThrow(/besitzt du nicht/);
    expect(world.player.clothing.wornOutfit).toBeNull();
  });

  it('erhaelt Besitz und Trage-Slots ueber Save und Load', () => {
    const { world, ledger } = setup();
    buyClothing(world, ledger, 'JACKE_DESIGNER', 0);
    buyClothing(world, ledger, 'BRILLE_MARKE', 0);
    wearClothing(world, 'JACKE_DESIGNER');
    wearClothing(world, 'BRILLE_MARKE');

    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))))!.world;

    expect(loaded.player.clothing).toEqual(world.player.clothing);
    expect(styleBonus(loaded)).toBe(styleBonus(world));
  });

  it('verwirft unbekannte und nicht besessene Stuecke aus alten Saves', () => {
    expect(normalizeClothing({ owned: ['JACKE_DESIGNER', 'ERFUNDEN'], wornOutfit: 'ERFUNDEN', wornAccessory: 'KETTE_GOLD' }))
      .toEqual({ owned: ['JACKE_DESIGNER'], wornOutfit: null, wornAccessory: null });
    expect(normalizeClothing(null)).toEqual({ owned: [], wornOutfit: null, wornAccessory: null });
  });
});

describe('Auftreten als begrenzter Faktor', () => {
  it('hebt die Ansprechchance gedeckelt und nur bei echter Kleidung', () => {
    const { world, ledger } = setup();
    const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
    const neutral = talkChance(world, guest.id);

    buyClothing(world, ledger, 'JACKE_DESIGNER', 0);
    wearClothing(world, 'JACKE_DESIGNER');
    expect(talkChance(world, guest.id)).toBe(neutral + 6);

    buyClothing(world, ledger, 'KETTE_GOLD', 0);
    wearClothing(world, 'KETTE_GOLD');
    const dressed = talkChance(world, guest.id);
    expect(dressed).toBe(neutral + 10);
    expect(dressed - neutral).toBeLessThanOrEqual(10);
    expect(talkChance(world, 999_999)).toBe(0);
  });
});
