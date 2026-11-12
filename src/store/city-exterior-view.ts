/**
 * Eine Exterieur-Ansicht je gespeicherter Stadt.
 *
 * Der Renderplan haengt an dieser Identitaet. Ohne den Cache wuerde jeder Tick
 * ein neues Objekt samt neuem Plan bauen, obwohl sich die Stadt nicht bewegt.
 */
import type { CityExteriorModel } from '../core/sim/city-exterior';
import type { CitySceneState } from '../core/sim/types';

const VIEWS = new WeakMap<CitySceneState, CityExteriorModel>();

export function cityExteriorView(city: CitySceneState): CityExteriorModel {
  let view = VIEWS.get(city);
  if (!view) {
    view = { ...city.exterior, layout: city.layout };
    VIEWS.set(city, view);
  }
  return view;
}
