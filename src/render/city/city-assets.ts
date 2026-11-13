/**
 * Stadt-Assetpaket: die eine Metadatenquelle fuer sichtbare Stadttexturen.
 *
 * Die zehn vorhandenen SVGs sind Fassaden, Tuer, Laterne, Bank, Muell, Haltestelle
 * und Baum. Strasse, Gehweg und Kante sind Geometrie/Material im Layout und keine
 * eigenen Bilddateien. Jeder Eintrag braucht Rolle, Welt, ganzzahlige Anzeigeskala
 * und eine Rechteangabe; fehlende Werte werden vom Validator abgewiesen.
 */
import { ASSET } from '../assets/keys';

export const CITY_WORLD = 'city' as const;
export const CITY_LICENSE = 'operator-confirmed' as const;

export const CITY_ROLES = ['FACADE', 'DOOR', 'LAMP', 'BENCH', 'TRASH', 'SIGN', 'TREE'] as const;
type CityAssetRole = (typeof CITY_ROLES)[number];

export interface CityAssetDefinition {
  readonly id: string;
  readonly role: CityAssetRole;
  readonly asset: string;
  readonly world: typeof CITY_WORLD;
  readonly displayScale: number;
  readonly license: typeof CITY_LICENSE;
}

/**
 * Die Schluessel sind stabile Metadaten-IDs, nicht Anzeigenamen. Die Asset-Pfade
 * kommen aus `ASSET.city`; `city-roles.ts` bleibt die Zuordnung von Gebaeude- und
 * Requisitenart auf die sichtbare Rolle.
 */
export const CITY_ASSETS = {
  'facade-apartment': {
    id: 'facade-apartment',
    role: 'FACADE',
    asset: ASSET.city.apartment,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'facade-pub': {
    id: 'facade-pub',
    role: 'FACADE',
    asset: ASSET.city.pub,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'facade-shop': {
    id: 'facade-shop',
    role: 'FACADE',
    asset: ASSET.city.shop,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'facade-casino': {
    id: 'facade-casino',
    role: 'FACADE',
    asset: ASSET.city.casino,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'street-door': {
    id: 'street-door',
    role: 'DOOR',
    asset: ASSET.city.door,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'street-light': {
    id: 'street-light',
    role: 'LAMP',
    asset: ASSET.city.streetLight,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'street-bench': {
    id: 'street-bench',
    role: 'BENCH',
    asset: ASSET.city.bench,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'street-trash': {
    id: 'street-trash',
    role: 'TRASH',
    asset: ASSET.city.trashBin,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'bus-stop-sign': {
    id: 'bus-stop-sign',
    role: 'SIGN',
    asset: ASSET.city.busStop,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
  'street-tree': {
    id: 'street-tree',
    role: 'TREE',
    asset: ASSET.city.tree,
    world: CITY_WORLD,
    displayScale: 1,
    license: CITY_LICENSE,
  },
} as const satisfies Readonly<Record<string, CityAssetDefinition>>;

export const CITY_ASSET_LIST: readonly CityAssetDefinition[] = Object.values(CITY_ASSETS);

/** Liefert die Metadaten einer Textur; unbekannte Pfade sind ein Vertragsbruch. */
export function cityAssetForAsset(asset: string): CityAssetDefinition | null {
  return CITY_ASSET_LIST.find((entry) => entry.asset === asset) ?? null;
}

/** Ganzzahlige Anzeigeskala aus dem Stadtpaket; kein stiller Default fuer Fremdpfade. */
export function cityDisplayScale(asset: string): number {
  const entry = cityAssetForAsset(asset);
  if (!entry) throw new Error(`[city] Keine Asset-Metadaten fuer ${asset}`);
  return entry.displayScale;
}

/** Debug-/Abnahmelabel fuer den Pixi-Knoten: Welt, Rolle und stabile ID. */
export function cityRenderLabel(asset: string): string {
  const entry = cityAssetForAsset(asset);
  if (!entry) throw new Error(`[city] Keine Asset-Metadaten fuer ${asset}`);
  return `${entry.world}:${entry.role}:${entry.id}`;
}

/** Einzelpruefung; `displayScale` muss eine positive ganze Zahl sein. */
export function cityAssetIssues(asset: CityAssetDefinition): string[] {
  const issues: string[] = [];
  if (!asset.id.trim()) issues.push('id fehlt');
  if (!asset.role.trim()) issues.push(`${asset.id}: role fehlt`);
  if (!asset.asset.trim()) issues.push(`${asset.id}: asset fehlt`);
  if (asset.world !== CITY_WORLD) issues.push(`${asset.id}: world=${asset.world}`);
  if (!Number.isInteger(asset.displayScale) || asset.displayScale < 1 || asset.displayScale > 4) {
    issues.push(`${asset.id}: displayScale=${String(asset.displayScale)}`);
  }
  if (asset.license !== CITY_LICENSE) issues.push(`${asset.id}: license=${asset.license}`);
  return issues;
}

/** Paketpruefung inklusive doppelter IDs und doppelter Texturpfade. */
export function validateCityAssets(assets: readonly CityAssetDefinition[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  const refs = new Set<string>();
  for (const asset of assets) {
    issues.push(...cityAssetIssues(asset));
    if (ids.has(asset.id)) issues.push(`${asset.id}: doppelte ID`);
    else ids.add(asset.id);
    if (refs.has(asset.asset)) issues.push(`${asset.id}: doppelte Textur ${asset.asset}`);
    else refs.add(asset.asset);
  }
  return issues;
}
