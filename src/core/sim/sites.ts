import type { PropertyId } from './types-model';
import type { VaCoinMicro } from '../economy/vacoin';

/** Stabile, gueltige Kennung eines eigenen Standorts, ueber Saves hinweg. */
export type SiteId = string;

/** Betriebsstatus: erworben, aber noch nicht im laufenden Betrieb (spaetere Phasen). */
export type SiteStatus = 'acquired' | 'operational';

/** Ein eigener Standort mit Bindung an das vorhandene Raster und an das eine Hauskonto. */
export interface OwnedSite {
  readonly siteId: SiteId;
  readonly propertyId: PropertyId;
  readonly siteBinding: string | null;
  readonly priceVC: VaCoinMicro;
  readonly day: number;
  readonly status: SiteStatus;
}
