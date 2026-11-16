import type { PropertyId } from './types-model';

interface PropertyOffer {
  readonly id: PropertyId;
  readonly label: string;
  readonly description: string;
  /** Kaufpreis in ganzen VC; der Ledger bucht daraus Micro. */
  readonly priceVC: number;
}

export const PROPERTY_OFFERS: readonly PropertyOffer[] = [
  { id: 'GEWERBERAUM', label: 'Gewerberaum', priceVC: 60,
    description: 'Nuechterner Raum im Hinterhaus. Strom und Wasser liegen, mehr nicht.' },
  { id: 'KNEIPE', label: 'Kleine Kneipe', priceVC: 120,
    description: 'Tresen, Kuehlung und Stammpublikum - der Raum bringt Gaeste mit.' },
  { id: 'SPIELSALON', label: 'Geschlossener Spielsalon', priceVC: 200,
    description: 'Verdunkelt, mit alter Verkabelung. Die Automaten kommen spaeter.' },
];

const PROPERTY_IDS: ReadonlySet<string> = new Set(PROPERTY_OFFERS.map((offer) => offer.id));

export { PROPERTY_IDS };

export function propertyOffer(id: string): PropertyOffer {
  const offer = PROPERTY_OFFERS.find((entry) => entry.id === id);
  if (!offer) throw new Error(`Unbekannte Immobilie: ${id}.`);
  return offer;
}
