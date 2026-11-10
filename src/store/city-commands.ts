/** Store-Bruecke: die Stadt bleibt headless, hier wird nur verdrahtet. */
import type { Ledger } from '../core/economy/ledger';
import type { Prng } from '../core/rng/prng';
import { restInCity, runCityAction, travel, type CityLocationId } from '../core/sim/city';
import { backyardFight } from '../core/sim/fight-career';
import { encounterDialog, meetNpc, takeEncounterAction } from '../core/sim/city-encounter';
import { buyProperty } from '../core/sim/property';
import type { EncounterAction } from '../core/sim/city-types';
import type { WorldState } from '../core/sim/types';

/** Reisen setzt den Ort und meldet den sichtbaren Zustandswechsel. */
function travelCmd(world: WorldState, location: CityLocationId): string {
  travel(world, location);
  return world.lastEvent;
}

/** Eine Handlung im Ort; Fehler kommen unveraendert beim Aufrufer an. */
function cityActionCmd(world: WorldState, actionId: string): string {
  return runCityAction(world, actionId).lastResult;
}

/** Tag beenden fuellt die Energie ueber den Kalender, nicht als Geschenk. */
function cityRestCmd(world: WorldState, ledger: Ledger, prng: Prng): string {
  return restInCity(world, ledger, prng).lastResult;
}

/** Eine Begegnung oeffnen und ihren Spieltext zurueckgeben. */
function meetCmd(world: WorldState, ledger: Ledger, location?: CityLocationId): string {
  const { event } = meetNpc(world, location ?? undefined);
  return encounterDialog(world, ledger, event.id).text;
}

/** Eine soziale Handlung in der offenen Begegnung. */
function encounterCmd(world: WorldState, ledger: Ledger, eventId: number, action: EncounterAction): string {
  return takeEncounterAction(world, ledger, eventId, action).text;
}

/** Erste Immobilie: der Kauf laeuft wie jeder Kauf durch das Portemonnaie. */
function propertyCmd(world: WorldState, ledger: Ledger, propertyId: string): string {
  buyProperty(world, ledger, propertyId, world.tick);
  return world.lastEvent;
}

/** Alle Stadt-Eingaben der UI laufen durch genau diesen einen Einstieg. */
export type CityCommand =
  | { readonly kind: 'travel'; readonly location: CityLocationId }
  | { readonly kind: 'act'; readonly actionId: string }
  | { readonly kind: 'rest' }
  | { readonly kind: 'meet'; readonly location?: CityLocationId }
  | { readonly kind: 'encounter'; readonly eventId: number; readonly action: EncounterAction }
  | { readonly kind: 'backyardFight' }
  | { readonly kind: 'buyProperty'; readonly propertyId: string };

export function cityCmd(world: WorldState, ledger: Ledger, prng: Prng, cmd: CityCommand): string {
  if (cmd.kind === 'travel') return travelCmd(world, cmd.location);
  if (cmd.kind === 'act') return cityActionCmd(world, cmd.actionId);
  if (cmd.kind === 'meet') return meetCmd(world, ledger, cmd.location);
  if (cmd.kind === 'encounter') return encounterCmd(world, ledger, cmd.eventId, cmd.action);
  if (cmd.kind === 'backyardFight') return backyardFight(world, ledger, prng).notice;
  if (cmd.kind === 'buyProperty') return propertyCmd(world, ledger, cmd.propertyId);
  return cityRestCmd(world, ledger, prng);
}
