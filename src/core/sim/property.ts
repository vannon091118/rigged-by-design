/**
 * Erste Immobilie: Katalog, Kauf aus dem Portemonnaie und gespeicherte Eigentumszuweisung.
 *
 * Der Besitz ist ein Datensatz, kein zweiter Geldweg: die Zahlung laeuft wie jeder
 * Kauf ueber den Ledger (PORTEMONNAIE -> EXTERNAL), der Beleg steht im Archiv.
 * Die Bude aus `player-jobs` bleibt der persoenliche Wohnraum; diese Immobilie ist
 * Gewerbeflaeche und wird erst in Agent 08 an den WorldState angeschlossen.
 */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { recordJournal } from './journal';
import { EXTERNAL, PORTEMONNAIE } from './money';
import { TX_REASON } from './tx-reasons';
import type { OwnedProperty, PropertyId, WorldState } from './types';

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

export function propertyOffer(id: string): PropertyOffer {
  const offer = PROPERTY_OFFERS.find((entry) => entry.id === id);
  if (!offer) throw new Error(`Unbekannte Immobilie: ${id}.`);
  return offer;
}

/**
 * Alte Saves kennen das Feld nicht: alles Unbekannte wird zu "kein Eigentum",
 * nie zu einem halben Datensatz. Damit braucht die Erweiterung keinen Versionssprung.
 */
export function hydrateProperty(raw: unknown): OwnedProperty | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as { id?: unknown; priceVC?: unknown; day?: unknown };
  if (typeof record.id !== 'string' || !PROPERTY_IDS.has(record.id)) return null;
  const priceVC = Number(record.priceVC);
  const day = Number(record.day);
  if (!Number.isSafeInteger(priceVC) || priceVC < 0) return null;
  if (!Number.isSafeInteger(day) || day < 1) return null;
  return { id: record.id as PropertyId, priceVC: priceVC as VaCoinMicro, day };
}

export function buyProperty(
  world: WorldState,
  ledger: { getBalance: (account: string) => VaCoinMicro; transfer: (from: string, to: string, amount: VaCoinMicro, reason: string, tick: number) => void },
  id: string,
  tick: number,
): OwnedProperty {
  const current = world.player.property;
  if (current !== null) throw new Error(`Du besitzt bereits eine Immobilie: ${propertyOffer(current.id).label}.`);
  const offer = propertyOffer(id);
  const cost = fromVC(offer.priceVC);
  if (ledger.getBalance(PORTEMONNAIE) < cost) {
    throw new Error(`Nicht genug Bargeld. Benötigt: ${offer.priceVC} VC für ${offer.label}.`);
  }
  ledger.transfer(PORTEMONNAIE, EXTERNAL, cost, TX_REASON.PROPERTY, tick);
  const owned: OwnedProperty = { id: offer.id, priceVC: cost, day: world.day };
  world.player.property = owned;
  world.lastEvent = `Erste Immobilie gekauft: ${offer.label} für ${offer.priceVC} VC.`;
  recordJournal(world, {
    kind: 'SYSTEM', subject: 'IMMOBILIE', cause: 'Erster Immobilienkauf',
    effect: `${offer.label} für ${offer.priceVC} VC aus dem Portemonnaie bezahlt.`,
  });
  return owned;
}

interface PropertyOfferView extends PropertyOffer {
  readonly owned: boolean;
  readonly affordable: boolean;
}

export interface PlayerPropertyView {
  readonly owned: OwnedProperty | null;
  readonly offers: readonly PropertyOfferView[];
}

/** Eine Sicht fuer Charakterfenster und Tests; die Anzeige rechnet nichts nach. */
export function propertyView(world: WorldState, wallet: VaCoinMicro): PlayerPropertyView {
  const owned = world.player.property;
  return {
    owned,
    offers: PROPERTY_OFFERS.map((offer) => ({
      ...offer,
      owned: owned?.id === offer.id,
      affordable: wallet >= fromVC(offer.priceVC),
    })),
  };
}
