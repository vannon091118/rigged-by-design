/** Store-Bruecke: die Stadt bleibt headless, hier wird nur verdrahtet. */
import { restInCity, runCityAction, travel, type CityLocationId } from '../core/sim/city';
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
function cityRestCmd(world: WorldState): string {
  return restInCity(world).lastResult;
}

/** Alle Stadt-Eingaben der UI laufen durch genau diesen einen Einstieg. */
export type CityCommand =
  | { readonly kind: 'travel'; readonly location: CityLocationId }
  | { readonly kind: 'act'; readonly actionId: string }
  | { readonly kind: 'rest' };

export function cityCmd(world: WorldState, cmd: CityCommand): string {
  if (cmd.kind === 'travel') return travelCmd(world, cmd.location);
  if (cmd.kind === 'act') return cityActionCmd(world, cmd.actionId);
  return cityRestCmd(world);
}
