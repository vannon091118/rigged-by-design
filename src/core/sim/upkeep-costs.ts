/** Laufende Wohnkosten: eine Quelle fuer Tagesbuchung und HUD-Ziel. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { PriceBook } from './types-model';

/** Die Tagesmiete samt Strom ist das Doppelte des Reinigungssatzes. */
const HOUSING_COST_FACTOR = 2;

export function dailyHousingCost(prices: Pick<PriceBook, 'cleaningCost'>): VaCoinMicro {
  return (prices.cleaningCost * HOUSING_COST_FACTOR) as VaCoinMicro;
}
