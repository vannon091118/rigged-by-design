/**
 * Eigentum: Katalog, Kauf aus dem Portemonnaie, eindeutige Standort-Bindung und
 * Derivat aus dem vorhandenen WorldState.
 *
 * Der Besitz ist ein Datensatz, kein zweiter Geldweg: die Zahlung laeuft wie jeder
 * Kauf ueber den Ledger (PORTEMONNAIE -> EXTERNAL), der Beleg steht im Archiv.
 * Mehrere eigene Standorte sind moglich; jeder traegt eine stabile Site-ID.
 * Die Lage wird nicht gespeichert, sondern aus dem vorhandenen Raster abgeleitet
 * (`areaAt`): der 30x30-Bereich, in dem der Eingang liegt. Damit gibt es keine
 * zweite Wahrheit neben `layout`, `zones` und `furniture`, und alte Saves bleiben
 * ohne Versionssprung lesbar. Der Betrieb laeuft ueber das bestehende
 * Geschaeftskonto (`HAUSKONTO`), nicht ueber ein zweites Konto.
 */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import { areasFor, areaAt, type Area } from './grid-zones';
import { recordJournal } from './journal';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from './money';
import { TX_REASON } from './tx-reasons';
import { PROPERTY_OFFERS, PROPERTY_IDS, propertyOffer } from './property-offers';
import type { OwnedSite, SiteId } from './sites';
import type { Furniture, Guest, PropertyId, WorldState, Zone } from './types';

/** Das Geschaeftskonto der Immobilie ist das vorhandene Hauskonto, kein zweites Konto. */
export const PROPERTY_ACCOUNT = HAUSKONTO;

export function hydrateProperties(raw: unknown): OwnedSite[] {
  if (Array.isArray(raw)) {
    const sites: OwnedSite[] = [];
    for (const entry of raw) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as {
        siteId?: unknown; propertyId?: unknown; siteBinding?: unknown;
        priceVC?: unknown; day?: unknown; status?: unknown;
      };
      if (typeof record.siteId !== 'string' || record.siteId.length === 0) continue;
      if (typeof record.propertyId !== 'string' || !PROPERTY_IDS.has(record.propertyId)) continue;
      if (record.siteBinding !== null && typeof record.siteBinding !== 'string') continue;
      const priceVC = Number(record.priceVC);
      const day = Number(record.day);
      if (!Number.isSafeInteger(priceVC) || priceVC < 0) continue;
      if (!Number.isSafeInteger(day) || day < 1) continue;
      if (record.status !== 'acquired' && record.status !== 'operational') continue;
      sites.push({
        siteId: record.siteId,
        propertyId: record.propertyId as PropertyId,
        siteBinding: record.siteBinding ?? null,
        priceVC: priceVC as VaCoinMicro,
        day: day as number,
        status: record.status,
      });
    }
    return sites;
  }
  if (typeof raw === 'object' && raw !== null) {
    const record = raw as { id?: unknown; priceVC?: unknown; day?: unknown };
    if (typeof record.id === 'string' && PROPERTY_IDS.has(record.id)) {
      const priceVC = Number(record.priceVC);
      const day = Number(record.day);
      if (Number.isSafeInteger(priceVC) && priceVC >= 0 && Number.isSafeInteger(day) && day >= 1) {
        return [{
          siteId: `${record.id}-${day}-legacy`,
          propertyId: record.id as PropertyId,
          siteBinding: null,
          priceVC: priceVC as VaCoinMicro,
          day,
          status: 'acquired',
        }];
      }
    }
  }
  return [];
}

export function buyProperty(
  world: WorldState,
  ledger: { getBalance: (account: string) => VaCoinMicro; transfer: (from: string, to: string, amount: VaCoinMicro, reason: string, tick: number) => void },
  id: string,
  tick: number,
): OwnedSite {
  const offer = propertyOffer(id);
  const cost = fromVC(offer.priceVC);
  if (ledger.getBalance(PORTEMONNAIE) < cost) {
    throw new Error(`Nicht genug Bargeld. Benötigt: ${offer.priceVC} VC für ${offer.label}.`);
  }
  ledger.transfer(PORTEMONNAIE, EXTERNAL, cost, TX_REASON.PROPERTY, tick);
  const area = propertyAreaBinding(world);
  const owned: OwnedSite = {
    siteId: `${id}-${world.day}-${world.tick}`,
    propertyId: offer.id,
    siteBinding: area,
    priceVC: cost,
    day: world.day,
    status: 'acquired',
  };
  world.player.properties.push(owned);
  world.lastEvent = `Immobilie gekauft: ${offer.label} für ${offer.priceVC} VC.`;
  recordJournal(world, {
    kind: 'SYSTEM', subject: 'IMMOBILIE', cause: 'Immobilienkauf',
    effect: `${offer.label} für ${offer.priceVC} VC aus dem Portemonnaie bezahlt.`,
  });
  return owned;
}

/**
 * Eindeutige Zuordnung: die Immobilie liegt im Rasterbereich ihres Eingangs.
 * Ohne Eingang (alte oder fremde Plaene) entscheidet die Spielerposition.
 */
export function propertyAreaBinding(world: WorldState): string | null {
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE') ?? world.zones[0];
  const tile = entrance ?? world.player.position;
  const area = areaAt(world.template, tile.x, tile.y);
  return area ? area.id : null;
}

function inArea(area: Area, x: number, y: number): boolean {
  return x >= area.x && x < area.x + area.w && y >= area.y && y < area.h;
}

/** Der Betrieb eines Standorts, abgeleitet aus Grid, Zonen, Moebeln und Besuchern. */
export interface PropertyWorldBinding {
  readonly owned: OwnedSite;
  readonly area: Area | null;
  readonly zones: readonly Zone[];
  readonly furniture: readonly Furniture[];
  readonly guests: readonly Guest[];
  /** Geschaeftskonto, ueber das der Betrieb bucht. */
  readonly account: string;
}

/**
 * Eine Immobilie ohne WorldState-Anschluss waere nur ein Etikett: diese Bindung
 * sagt, welche Zonen, Geraete und Gaeste zu einem Standort gehoeren. Sie ist
 * reine Ableitung und wird nirgends gespeichert. Ohne siteId wird der erste
 * eigene Standort gebunden.
 */
export function propertyWorld(world: WorldState, siteId?: SiteId | null): PropertyWorldBinding | null {
  const owned = siteId ? world.player.properties.find((site) => site.siteId === siteId) : world.player.properties[0];
  if (!owned) return null;
  const area = owned.siteBinding ? areasFor(world.template).find((candidate) => candidate.id === owned.siteBinding) ?? null : null;
  return {
    owned,
    area,
    zones: area ? world.zones.filter((zone) => inArea(area, zone.x, zone.y)) : [],
    furniture: area ? world.furniture.filter((item) => inArea(area, item.x, item.y)) : [],
    guests: area ? world.guests.filter((guest) => inArea(area, guest.position.x, guest.position.y)) : [],
    account: PROPERTY_ACCOUNT,
  };
}

interface PropertyOfferView {
  readonly id: PropertyId;
  readonly label: string;
  readonly description: string;
  readonly priceVC: number;
  readonly owned: boolean;
  readonly affordable: boolean;
}

export interface PlayerPropertyView {
  readonly owned: OwnedSite | null;
  readonly properties: readonly OwnedSite[];
  readonly offers: readonly PropertyOfferView[];
  /** Betriebsbindung an den WorldState; null ohne Eigentum. */
  readonly binding: PropertyWorldBinding | null;
}

/** Eine Sicht fuer Charakterfenster und Tests; die Anzeige rechnet nichts nach. */
export function propertyView(world: WorldState, wallet: VaCoinMicro): PlayerPropertyView {
  const owned = world.player.properties;
  return {
    owned: owned.length > 0 ? owned[0]! : null,
    properties: owned,
    binding: propertyWorld(world),
    offers: PROPERTY_OFFERS.map((offer) => ({
      ...offer,
      owned: owned.some((site) => site.propertyId === offer.id),
      affordable: wallet >= fromVC(offer.priceVC),
    })),
  };
}
