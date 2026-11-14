/**
 * @module city-tick — ein Tick Stadt in der richtigen Reihenfolge
 *
 * Die Stadt lebt auch, während der Spieler im eigenen Casino steht: erst die
 * Stundenentscheidung der Bewohner, dann ihre Wege in Kacheln, zuletzt das
 * Wachstum. Die Reihenfolge ist Vertrag — das Wachstum sieht die Bewohner, die
 * dieser Tick schon bewegt hat, und kein Schritt liest einen halben Zustand.
 */
import type { Ledger } from '../economy/ledger';
import { completeCityConstruction } from './city-construction';
import { advanceCityGrowth } from './city-growth';
import { tickCityLife } from './city-life';
import { tickCityMovement } from './city-life-movement';
import type { WorldState } from './types';

export function tickCity(world: WorldState, ledger: Ledger): void {
  // Die Stadt lebt auch waehrend der Spieler im eigenen Casino steht.
  tickCityLife(world);
  // Wege laufen in Kacheln, nicht in Stunden: erst der Tick macht Bewegung sichtbar.
  tickCityMovement(world);
  // Wachstum folgt dem Signal (Joblose); finanziert wird aus Startkapital und
  // Stadtfoerderung, jede Bewegung im Ledger (#525).
  advanceCityGrowth(world, ledger);
  // Der Vortag wird zuerst fertig: Rohbau oeffnen, dann erst weiterbauen (#524).
  completeCityConstruction(world);
}
