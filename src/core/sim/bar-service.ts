/**
 * Bedienung an der Bar: der Drink aus der Karte und der Toilettengang.
 * Eigenes Modul, weil die Lieferkette in `deliveries.ts` ihr Budget bereits
 * ausfuellt; Bestand, Preis und Laune bleiben dieselben Felder wie dort.
 */
import type { Ledger } from '../economy/ledger';
import { drinkMenu, pickDrink } from './drink-menu';
import { clamp } from './guest-core';
import { HAUSKONTO } from './money';
import { TX_REASON } from './tx-reasons';
import type { Furniture, Guest, WorldState } from './types';

const near = (ax: number, ay: number, bx: number, by: number, range: number): boolean =>
  Math.abs(ax - bx) + Math.abs(ay - by) <= range;

/**
 * Ein Drink an der Bar: Bestand runter, Durst weg, Laune rauf. Welcher Drink
 * serviert wird, entscheidet die Getraenkekarte, nicht ein zweiter Preis.
 */
export function deliverDrink(world: WorldState, ledger: Ledger, guest: Guest, bar: Furniture): boolean {
  if (bar.stock <= 0) {
    // Eine leere Bar ist Pech, kein Dauerzustand: kleiner Aerger, kein Nachfassen.
    guest.mood = Math.max(0, guest.mood - 2);
    world.lastEvent = 'Die Bar ist leer.';
    return false;
  }
  const drink = pickDrink(drinkMenu(world), guest);
  try {
    ledger.transfer(`VISITOR_${guest.id}`, HAUSKONTO, drink.price, TX_REASON.DRINK_SALE, world.tick);
  } catch { return false; }
  bar.stock -= 1;
  guest.thirst = 0;
  guest.mood = clamp(guest.mood + drink.moodGain + 2 * (world.barLevel - 1));
  guest.patience = clamp(guest.patience + 9);
  const barkeeper = world.agents.some((agent) =>
    agent.role === 'bartender' && near(agent.x, agent.y, bar.x, bar.y, 4));
  if (barkeeper) guest.patience = clamp(guest.patience + 4);
  return true;
}

/** Ein Toilettengang: Blase leer, Laune rauf, Abfluss voller. Volle Kabinen verstopfen. */
export function useToilet(world: WorldState, guest: Guest, wc: Furniture): boolean {
  if (wc.clogged) {
    guest.mood = Math.max(0, guest.mood - 6);
    guest.need = 'toilet';
    world.lastEvent = 'Das WC ist verstopft.';
    return false;
  }
  guest.bladder = 0;
  guest.mood = clamp(guest.mood + 7);
  guest.patience = clamp(guest.patience + 14);
  wc.clog += 1;
  if (wc.clog >= 3 + 2 * world.wcLevel) {
    wc.clogged = true;
    world.lastEvent = 'Ein WC ist verstopft.';
  }
  return true;
}
