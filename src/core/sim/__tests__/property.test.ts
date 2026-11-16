/** @test-target: src/core/sim/property.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { PROPERTY_OFFERS, propertyOffer } from '../property-offers';
import { buyProperty, hydrateProperties, propertyView } from '../property';
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
    expect(world.player.properties).toEqual([]);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(0));
    expect(world.journal.some((event) => event.subject === 'IMMOBILIE')).toBe(false);
  });

  it('bucht den Preis aus dem Portemonnaie und weist den Standort zu', () => {
    const { world, ledger } = setup(200);
    world.day = 4;
    const owned = buyProperty(world, ledger, 'KNEIPE', 42);
    expect(owned.propertyId).toBe('KNEIPE');
    expect(owned.day).toBe(4);
    expect(owned.status).toBe('acquired');
    expect(owned.siteId).toContain('KNEIPE');
    expect(world.player.properties).toHaveLength(1);
    expect(world.player.properties[0]!).toEqual(owned);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(80));
    expect(ledger.entries.some((entry) => entry.reason === 'immobilie kaufen')).toBe(true);
    expect(world.lastEvent).toContain('Kleine Kneipe');
    const journal = world.journal.filter((event) => event.subject === 'IMMOBILIE');
    expect(journal).toHaveLength(1);
    expect(journal[0]!.effect).toContain('120');
  });

  it('erlaubt den zweiten Kauf und weist jedem Standort eine eigene Site-ID zu', () => {
    const { world, ledger } = setup(300);
    buyProperty(world, ledger, 'GEWERBERAUM', 1);
    buyProperty(world, ledger, 'SPIELSALON', 2);
    expect(world.player.properties).toHaveLength(2);
    expect(world.player.properties[0]!.siteId).not.toBe(world.player.properties[1]!.siteId);
    expect(world.player.properties.map((site) => site.propertyId)).toEqual(['GEWERBERAUM', 'SPIELSALON']);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(40));
  });
});

describe('Immobilien-Hydration', () => {
  it('macht aus fehlenden oder halben Daten keine Standorte', () => {
    expect(hydrateProperties(undefined)).toEqual([]);
    expect(hydrateProperties(null)).toEqual([]);
    expect(hydrateProperties({})).toEqual([]);
    expect(hydrateProperties({ id: 'BURG', priceVC: 1, day: 1 })).toEqual([]);
    expect(hydrateProperties({ id: 'KNEIPE', priceVC: -1, day: 1 })).toEqual([]);
    expect(hydrateProperties({ id: 'KNEIPE', priceVC: 1, day: 0 })).toEqual([]);
  });

  it('wandelt einen legacy-Einzeltrag in einen Standort mit synthetischer Site-ID um', () => {
    expect(hydrateProperties({ id: 'SPIELSALON', priceVC: fromVC(200), day: 7 })).toEqual([{
      siteId: 'SPIELSALON-7-legacy',
      propertyId: 'SPIELSALON',
      siteBinding: null,
      priceVC: fromVC(200),
      day: 7,
      status: 'acquired',
    }]);
  });
});

describe('Immobilien-Sicht', () => {
  it('markiert Besitz und Bezahlbarkeit aus dem Portemonnaie', () => {
    const { world } = setup();
    const before = propertyView(world, fromVC(130));
    expect(before.owned).toBeNull();
    expect(before.properties).toEqual([]);
    expect(before.offers.map((offer) => offer.affordable)).toEqual([true, true, false]);

    world.player.properties = [{
      siteId: 'test-gew-2', propertyId: 'GEWERBERAUM', siteBinding: null,
      priceVC: fromVC(60), day: 2, status: 'acquired',
    }];
    const after = propertyView(world, fromVC(0));
    expect(after.owned?.propertyId).toBe('GEWERBERAUM');
    expect(after.properties).toHaveLength(1);
    expect(after.offers.filter((offer) => offer.owned).map((offer) => offer.id)).toEqual(['GEWERBERAUM']);
    expect(after.offers.every((offer) => !offer.affordable)).toBe(true);
  });
});
