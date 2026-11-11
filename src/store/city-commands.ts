/** Store-Bruecke: die Stadt bleibt headless, hier wird nur verdrahtet. */
import type { Ledger } from '../core/economy/ledger';
import type { Prng } from '../core/rng/prng';
import { restInCity, runCityAction, travel, type CityLocationId } from '../core/sim/city';
import { backyardFight } from '../core/sim/fight-career';
import { enterFightEvent } from '../core/sim/fight-event';
import { encounterDialog, meetNpc, takeEncounterAction } from '../core/sim/city-encounter';
import { buyProperty } from '../core/sim/property';
import { renovate } from '../core/sim/renovation';
import { maintainMachine } from '../core/sim/machine-hall';
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

/** Renovierung: derselbe Immobilien-Einstieg, Material aus dem Lager, Geld vom Betriebskonto. */
function renovateCmd(world: WorldState, ledger: Ledger): string {
  renovate(world, ledger);
  return world.lastEvent;
}

/** Wartung: derselbe Immobilien-Einstieg wie Kauf und Renovierung, ohne Ersatzteil. */
function maintainMachineCmd(world: WorldState, ledger: Ledger, itemId: number): string {
  maintainMachine(world, ledger, itemId);
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
  | { readonly kind: 'fightEvent' }
  | { readonly kind: 'buyProperty'; readonly propertyId: string }
  | { readonly kind: 'renovate' }
  | { readonly kind: 'maintainMachine'; readonly itemId: number };

export function cityCmd(world: WorldState, ledger: Ledger, prng: Prng, cmd: CityCommand): string {
  if (cmd.kind === 'travel') return travelCmd(world, cmd.location);
  if (cmd.kind === 'act') return cityActionCmd(world, cmd.actionId);
  if (cmd.kind === 'meet') return meetCmd(world, ledger, cmd.location);
  if (cmd.kind === 'encounter') return encounterCmd(world, ledger, cmd.eventId, cmd.action);
  if (cmd.kind === 'backyardFight') return backyardFight(world, ledger, prng).notice;
  if (cmd.kind === 'fightEvent') return enterFightEvent(world, ledger, prng).notice;
  if (cmd.kind === 'buyProperty') return propertyCmd(world, ledger, cmd.propertyId);
  if (cmd.kind === 'renovate') return renovateCmd(world, ledger);
  if (cmd.kind === 'maintainMachine') return maintainMachineCmd(world, ledger, cmd.itemId);
  return cityRestCmd(world, ledger, prng);
}
