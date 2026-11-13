/**
 * @module city-network — das Stadtnetz als eine Knoten-/Kantenliste
 *
 * Die Stadt ist kein Menue: Wohnung, Casino, Kneipe und Markt sind Knoten, die
 * vier Strassentueren sind die Kanten von der Strasse dorthin. Diese Liste ist
 * die einzige Zielwahrheit. `city-doors` leitet seine Wirkung daraus ab, damit
 * ein neuer Ort nicht an einer zweiten Tabelle vorbei eingebaut werden kann.
 */
export const CITY_NETWORK_NODE_IDS = ['STREET', 'APARTMENT', 'CASINO', 'KIEZ', 'MARKT'] as const;
export type CityNetworkNodeId = (typeof CITY_NETWORK_NODE_IDS)[number];

/** Die Strasse ist der Verteiler; alle Kanten beginnen hier. */
export const CITY_NETWORK_HUB = 'STREET' as const;

/** Ziel einer Tuerkante; die Strasse ist Verteiler, kein Ziel. */
export type CityNetworkPlaceId = Exclude<CityNetworkNodeId, typeof CITY_NETWORK_HUB>;

export interface CityNetworkNode {
  readonly id: CityNetworkNodeId;
  readonly label: string;
  /** Nur die vier Ziele einer Tuer; die Strasse hat keine Tuerkante. */
  readonly hasDoor: boolean;
}

export const CITY_NETWORK_NODES: readonly CityNetworkNode[] = Object.freeze([
  { id: 'STREET', label: 'Kiez-Hauptstraße', hasDoor: false },
  { id: 'APARTMENT', label: 'Wohnung', hasDoor: true },
  { id: 'CASINO', label: 'Casino Grand', hasDoor: true },
  { id: 'KIEZ', label: 'Kiezkneipe Zum Nagel', hasDoor: true },
  { id: 'MARKT', label: 'Späti am Markt', hasDoor: true },
]);

/** Genau die vier Tuer-IDs aus `createCityStreetLayout()`. */
export const CITY_STREET_DOOR_IDS = [
  'door_street_to_player_apt',
  'door_street_to_kiez_pub',
  'door_street_to_corner_shop',
  'door_street_to_casino_grand',
] as const;
export type CityStreetDoorId = (typeof CITY_STREET_DOOR_IDS)[number];

export type CityDoorEffect =
  | { readonly kind: 'APARTMENT' }
  | { readonly kind: 'CASINO' }
  | { readonly kind: 'CITY_LOCATION'; readonly location: 'KIEZ' | 'MARKT' };

export interface CityNetworkEdge {
  readonly doorId: CityStreetDoorId;
  readonly from: typeof CITY_NETWORK_HUB;
  readonly to: CityNetworkPlaceId;
  readonly effect: CityDoorEffect;
  /** Wie der Spieler die Kante erlebt; dient der Abnahme und dem Text. */
  readonly label: string;
}

const EDGES: readonly CityNetworkEdge[] = Object.freeze([
  Object.freeze({
    doorId: 'door_street_to_player_apt', from: CITY_NETWORK_HUB, to: 'APARTMENT',
    effect: Object.freeze({ kind: 'APARTMENT' }), label: 'Haustür zur Wohnung',
  }),
  Object.freeze({
    doorId: 'door_street_to_casino_grand', from: CITY_NETWORK_HUB, to: 'CASINO',
    effect: Object.freeze({ kind: 'CASINO' }), label: 'Eingang Casino Grand',
  }),
  Object.freeze({
    doorId: 'door_street_to_kiez_pub', from: CITY_NETWORK_HUB, to: 'KIEZ',
    effect: Object.freeze({ kind: 'CITY_LOCATION', location: 'KIEZ' }), label: 'Tür zur Kiezkneipe',
  }),
  Object.freeze({
    doorId: 'door_street_to_corner_shop', from: CITY_NETWORK_HUB, to: 'MARKT',
    effect: Object.freeze({ kind: 'CITY_LOCATION', location: 'MARKT' }), label: 'Tür zum Späti',
  }),
]);

/** Alle Kanten in fester Reihenfolge; die Quelle für Türen, Tests und UI. */
export function cityNetworkEdges(): readonly CityNetworkEdge[] {
  return EDGES;
}

/** Kante zu einer Tür oder null — unbekannte Türen bleiben wirkungslos. */
export function cityNetworkEdge(doorId: string): CityNetworkEdge | null {
  return EDGES.find((edge) => edge.doorId === doorId) ?? null;
}

/** Wendet die Netzkante an; es gibt keinen zweiten Effektpfad. */
export function cityDoorEffect(doorId: string): CityDoorEffect | null {
  return cityNetworkEdge(doorId)?.effect ?? null;
}

/** Alle Knoten, die von der Strasse aus über eine Tuer erreichbar sind. */
export function cityNetworkTargets(): readonly CityNetworkPlaceId[] {
  return EDGES.map((edge) => edge.to);
}
