/**
 * Getraenkekarte der Bar: eine Sicht auf `prices.drinkPrice` und `barLevel`.
 * Kein zweites Preisbuch, kein neues Save-Feld, kein zweiter Bestand - die Karte
 * beschreibt nur, was die vorhandene Bar aus dem einen WorldState fuehrt.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import { getPersona } from './personas';
import type { Guest } from './types';

type DrinkId = 'SPRITZ' | 'BIER' | 'COCKTAIL';

interface DrinkDef {
  readonly id: DrinkId;
  readonly name: string;
  /** Aufschlag in Prozent auf den Grundpreis; SPRITZ ist immer der Grundpreis. */
  readonly markupPct: number;
  readonly moodGain: number;
  readonly minBarLevel: number;
}

/** Die Karte in Angebotsreihenfolge; erst die Barstufe gibt den Drink frei. */
const DRINKS: readonly DrinkDef[] = [
  { id: 'SPRITZ', name: 'Spritz', markupPct: 0, moodGain: 8, minBarLevel: 1 },
  { id: 'BIER', name: 'Bier', markupPct: 50, moodGain: 10, minBarLevel: 1 },
  { id: 'COCKTAIL', name: 'Cocktail', markupPct: 150, moodGain: 16, minBarLevel: 3 },
];

interface DrinkEntry {
  readonly id: DrinkId;
  readonly name: string;
  readonly price: VaCoinMicro;
  readonly moodGain: number;
}

interface MenuSource {
  readonly barLevel: number;
  readonly prices: { readonly drinkPrice: VaCoinMicro };
}

const priceOf = (base: VaCoinMicro, markupPct: number): VaCoinMicro =>
  Math.round((base * (100 + markupPct)) / 100) as VaCoinMicro;

/** Die Karte, die diese Bar fuehrt; der Grundpreis bleibt der billigste Drink. */
export function drinkMenu(world: MenuSource): DrinkEntry[] {
  const level = Math.max(1, Math.floor(world.barLevel));
  return DRINKS.filter((drink) => drink.minBarLevel <= level).map((drink) => ({
    id: drink.id,
    name: drink.name,
    price: priceOf(world.prices.drinkPrice, drink.markupPct),
    moodGain: drink.moodGain,
  }));
}

/**
 * Welchen Drink dieser Gast bestellt: Durst und Trinkneigung der Persona waehlen
 * aus der Karte, ohne Wurf - derselbe Gast bestellt an derselben Bar dasselbe.
 */
export function pickDrink(menu: readonly DrinkEntry[], guest: Guest): DrinkEntry {
  const rate = getPersona(guest.persona).drinkRate;
  const target = guest.thirst >= 80 || rate >= 0.7 ? 2 : guest.thirst >= 50 || rate >= 0.4 ? 1 : 0;
  return menu[Math.min(target, menu.length - 1)]!;
}
