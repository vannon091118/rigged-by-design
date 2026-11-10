/** @test-target: src/core/sim/property.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { PROPERTY_OFFERS, buyProperty, hydrateProperty, propertyOffer, propertyView } from '../property';
import { createWorld } from '../templates';

function setup(walletVC = 0) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  if (walletVC > 0) ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(walletVC), 'test startgeld', 0);
  return { world, ledger };
}

describe('Immobilien-Katalog', () => {
  it('bietet Gewerberaum, Kneipe und Spielsalon mit steigendem Preis', () => {
    expect(PROPERTY_OFFERS.map((offer) => offer.id)).toEqual(['GEWERBERAUM', 'KNEIPE', 'SPIELSALON']);
    expect(PROPERTY_OFFERS.map((offer) => offer.priceVC)).toEqual([60, 120, 200]);
  });

  it('nennt den Preis zu einer Kennung und weist Unbekanntes ab', () => {
    expect(propertyOffer('KNEIPE').label).toBe('Kleine Kneipe');
    expect(() => propertyOffer('BURG')).toThrow(/Unbekannte Immobilie/);
  });
});

describe('Immobilien-Kauf', () => {
  it('verweigert den Kauf ohne Bargeld und laesst den Zustand unberuehrt', () => {
    const { world, ledger } = setup();
    expect(() => buyProperty(world, ledger, 'GEWERBERAUM', 5)).toThrow(/Nicht genug Bargeld/);
    expect(world.player.property).toBeNull();
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(0));
    expect(world.journal.some((event) => event.subject === 'IMMOBILIE')).toBe(false);
  });

  it('bucht den Preis aus dem Portemonnaie und weist das Eigentum zu', () => {
    const { world, ledger } = setup(200);
    world.day = 4;
    const owned = buyProperty(world, ledger, 'KNEIPE', 42);
    expect(owned).toEqual({ id: 'KNEIPE', priceVC: fromVC(120), day: 4 });
    expect(world.player.property).toEqual(owned);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(80));
    expect(ledger.entries.some((entry) => entry.reason === 'immobilie kaufen')).toBe(true);
    expect(world.lastEvent).toContain('Kleine Kneipe');
    const journal = world.journal.filter((event) => event.subject === 'IMMOBILIE');
    expect(journal).toHaveLength(1);
    expect(journal[0]!.effect).toContain('120');
  });

  it('verweigert den zweiten Kauf und nennt das bestehende Eigentum', () => {
    const { world, ledger } = setup(300);
    buyProperty(world, ledger, 'GEWERBERAUM', 1);
    expect(() => buyProperty(world, ledger, 'SPIELSALON', 2)).toThrow(/bereits eine Immobilie: Gewerberaum/);
    expect(world.player.property?.id).toBe('GEWERBERAUM');
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(240));
  });
});

describe('Immobilien-Hydration', () => {
  it('macht aus fehlenden oder halben Daten kein Eigentum', () => {
    expect(hydrateProperty(undefined)).toBeNull();
    expect(hydrateProperty(null)).toBeNull();
    expect(hydrateProperty({})).toBeNull();
    expect(hydrateProperty({ id: 'BURG', priceVC: 1, day: 1 })).toBeNull();
    expect(hydrateProperty({ id: 'KNEIPE', priceVC: -1, day: 1 })).toBeNull();
    expect(hydrateProperty({ id: 'KNEIPE', priceVC: 1, day: 0 })).toBeNull();
  });

  it('behaelt einen vollstaendigen Datensatz unveraendert', () => {
    expect(hydrateProperty({ id: 'SPIELSALON', priceVC: fromVC(200), day: 7 }))
      .toEqual({ id: 'SPIELSALON', priceVC: fromVC(200), day: 7 });
  });
});

describe('Immobilien-Sicht', () => {
  it('markiert Besitz und Bezahlbarkeit aus dem Portemonnaie', () => {
    const { world } = setup();
    const before = propertyView(world, fromVC(130));
    expect(before.owned).toBeNull();
    expect(before.offers.map((offer) => offer.affordable)).toEqual([true, true, false]);

    world.player.property = { id: 'GEWERBERAUM', priceVC: fromVC(60), day: 2 };
    const after = propertyView(world, fromVC(0));
    expect(after.owned?.id).toBe('GEWERBERAUM');
    expect(after.offers.filter((offer) => offer.owned).map((offer) => offer.id)).toEqual(['GEWERBERAUM']);
    expect(after.offers.every((offer) => !offer.affordable)).toBe(true);
  });
});
