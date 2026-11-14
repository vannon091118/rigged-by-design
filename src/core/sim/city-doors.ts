/**
 * Die Strassentüren und ihr bestehender Übergang.
 *
 * Die IDs kommen aus `createCityStreetLayout()`; die Ziele stehen im
 * Stadtnetz (`city-network`). Diese Datei ist nur noch die Fassade: eine
 * zweite Tabelle wuerde sonst neben dem Netz herlaufen und auseinanderdriften.
 * Die Tueren der Neubauten entstehen erst mit der Fertigstellung
 * (`door_grown_<buildingId>`) und kommen deshalb aus `city-construction` (#524).
 */
export {
  CITY_NETWORK_HUB,
  CITY_NETWORK_NODES,
  CITY_NETWORK_NODE_IDS,
  CITY_STREET_DOOR_IDS,
  cityDoorEffect,
  cityNetworkEdge,
  cityNetworkEdges,
  cityNetworkTargets,
} from './city-network';
export type {
  CityDoorEffect,
  CityNetworkEdge,
  CityNetworkNode,
  CityNetworkNodeId,
  CityNetworkPlaceId,
  CityStreetDoorId,
} from './city-network';
export {
  completeCityConstruction,
  grownDoorBuilding,
  grownDoorEffect,
  grownDoorId,
  isShell,
} from './city-construction';
