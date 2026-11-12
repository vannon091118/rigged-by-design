/**
 * Stadt als begehbarer Floor. Die Stadtkarte bleibt eine Uebersicht; dieser
 * Plan ist die Projektion, auf der die Figur tatsaechlich steht. Die Quelle
 * ist `createCityExteriorModel()`: 60x60 Strassen, Gebaeude und Requisiten
 * werden nicht als zweite Stadtkopie gepflegt.
 */
import { createCityExteriorModel, type CityExteriorModel } from './city-exterior';
import type { LayoutState } from './layout-types';
import type { Furniture, Point, Zone } from './types-model';

/** Alles aus dem Aussenwelt-Modell ausser dem Layout; das Layout bleibt oben. */
type CityExteriorState = Omit<CityExteriorModel, 'layout'>;

export interface CitySceneState {
  readonly layout: LayoutState;
  readonly zones: Zone[];
  readonly furniture: Furniture[];
  /** Anzeigedaten der einen Stadtwahrheit; kein zweiter Szenengraph. */
  readonly exterior: CityExteriorState;
}

/**
 * Die Stadt hat keine Portal-Furniture mehr: Gebaeude, Tueren und Requisiten
 * kommen aus dem Exterieur-Modell. Die frueheren Menue-Portale waren eine
 * zweite, 30x30 grosse Stadtkopie und hatten keinen Renderer.
 */
export function createCityScene(): CitySceneState {
  const exterior = createCityExteriorModel();
  const layout = exterior.layout;
  return {
    layout,
    zones: [...layout.zones],
    furniture: [],
    exterior: {
      layoutId: exterior.layoutId,
      name: exterior.name,
      buildings: exterior.buildings,
      props: exterior.props,
      playerApartmentStreetSpawn: exterior.playerApartmentStreetSpawn,
    },
  };
}

/**
 * Alte Saves tragen noch die 30x30-Projektion aus der Vorlage. Sie wird beim
 * Laden einmal auf das echte Exterieur gehoben; neue Saves behalten ihre
 * statische Stadtkopie, damit IDs und Eingaenge stabil bleiben.
 */
export function normalizeCityScene(raw?: CitySceneState | null): CitySceneState {
  if (!raw || !raw.exterior || raw.layout?.size !== 60) return createCityScene();
  if (!Array.isArray(raw.exterior.buildings) || !Array.isArray(raw.exterior.props)) return createCityScene();
  return raw;
}

/** Der Spieler betritt die Stadt vor seiner Haustuer, nicht auf der alten 2,2-Kachel. */
export const CITY_SPAWN: Point = { x: 8, y: 13 };
