/**
 * Pure Funktionen zur Verwaltung physischer Gebäude in der Living World.
 *
 * Gebäude sind keine UI-Menüs, sondern physisch verankerte Orte mit Eingang,
 * Grundfläche, Öffnungszeiten und nahtlosem Innenraum-Bezug.
 */
import type { BuildingState, CreateBuildingParams } from './building-types';
import { hourOfDay } from './clock';

/**
 * Erzeugt eine valide, unveränderliche BuildingState-Instanz.
 */
export function createBuilding(params: CreateBuildingParams): BuildingState {
  if (!params.id || params.id.trim() === '') {
    throw new Error('createBuilding: Gebäude-ID darf nicht leer sein');
  }
  if (!params.name || params.name.trim() === '') {
    throw new Error('createBuilding: Gebäude-Name darf nicht leer sein');
  }
  if (params.footprint.w <= 0 || params.footprint.h <= 0) {
    throw new Error('createBuilding: Grundfläche muss positive Maße haben');
  }

  return Object.freeze({
    id: params.id,
    name: params.name,
    kind: params.kind,
    footprint: Object.freeze({ ...params.footprint }),
    entrance: Object.freeze({ ...params.entrance }),
    interiorLayoutId: params.interiorLayoutId,
    ownerId: params.ownerId,
    tenantIds: Object.freeze([...(params.tenantIds ?? [])]),
    operatingHours: params.operatingHours ? Object.freeze({ ...params.operatingHours }) : undefined,
    locked: params.locked ?? false,
    occupancy: 0,
  });
}

/**
 * Prüft, ob ein Gebäude zur angegebenen Tagesstunde regulär geöffnet ist.
 * Öffnungszeiten können über Mitternacht laufen (z.B. Kneipe 18:00 - 04:00).
 */
export function isBuildingOpen(building: BuildingState, hour: number): boolean {
  if (!building.operatingHours) {
    // Ohne feste Öffnungszeiten: nur durch locked-Status begrenzt
    return !building.locked;
  }

  const { openHour, closeHour } = building.operatingHours;
  const normalizedHour = hourOfDay(hour);

  if (openHour <= closeHour) {
    // Normaler Tagesbetrieb, z.B. 08:00 bis 20:00
    return normalizedHour >= openHour && normalizedHour < closeHour;
  }

  // Nachtbetrieb über Mitternacht hinweg, z.B. 18:00 bis 04:00
  return normalizedHour >= openHour || normalizedHour < closeHour;
}

/**
 * Prüft, ob ein konkreter Akteur das Gebäude betreten darf.
 * Berücksichtigt Eigentum, Mieterstatus, Schlüssel und Öffnungszeiten.
 */
export function canActorEnterBuilding(
  building: BuildingState,
  actorId: string,
  currentHour: number,
  hasKey = false,
): boolean {
  // Eigentümer oder Mieter dürfen immer rein (haben Schlüssel)
  if (building.ownerId === actorId || building.tenantIds.includes(actorId) || hasKey) {
    return true;
  }

  // Wenn das Gebäude manuell verriegelt ist, bleibt es für Außenstehende zu
  if (building.locked) {
    return false;
  }

  // Für öffentliche Gebäude gelten die regulären Öffnungszeiten
  return isBuildingOpen(building, currentHour);
}

/**
 * Aktualisiert die Belegungszahl eines Gebäudes rein funktional.
 * Kann nie negativ werden.
 */
export function updateBuildingOccupancy(building: BuildingState, delta: number): BuildingState {
  const nextOccupancy = Math.max(0, building.occupancy + delta);
  if (nextOccupancy === building.occupancy) {
    return building;
  }
  return Object.freeze({
    ...building,
    occupancy: nextOccupancy,
  });
}

/**
 * Ändert den Sperrzustand eines Gebäudes rein funktional.
 */
export function setBuildingLocked(building: BuildingState, locked: boolean): BuildingState {
  if (building.locked === locked) {
    return building;
  }
  return Object.freeze({
    ...building,
    locked,
  });
}

/**
 * Die 4 kanonischen Start-Gebäude des ersten Stadtviertels.
 */
export const CITY_PRESET_BUILDINGS: readonly BuildingState[] = Object.freeze([
  createBuilding({
    id: 'bld_player_home',
    name: 'Wohnung des Spielers',
    kind: 'APARTMENT',
    footprint: { x: 4, y: 4, w: 10, h: 8 },
    entrance: { x: 8, y: 12 },
    interiorLayoutId: 'layout_player_apartment',
    ownerId: 'PLAYER',
    tenantIds: ['PLAYER'],
    locked: false,
  }),
  createBuilding({
    id: 'bld_kiez_pub',
    name: 'Kiezkneipe Zum Anker',
    kind: 'PUB',
    footprint: { x: 18, y: 4, w: 12, h: 10 },
    entrance: { x: 24, y: 14 },
    interiorLayoutId: 'layout_kiez_pub',
    operatingHours: { openHour: 16, closeHour: 4 },
    locked: false,
  }),
  createBuilding({
    id: 'bld_corner_shop',
    name: 'Späti 24 / Kiez-Laden',
    kind: 'SHOP',
    footprint: { x: 34, y: 4, w: 10, h: 8 },
    entrance: { x: 39, y: 12 },
    interiorLayoutId: 'layout_corner_shop',
    operatingHours: { openHour: 6, closeHour: 24 },
    locked: false,
  }),
  createBuilding({
    id: 'bld_casino_grand',
    name: 'Casino Grand',
    kind: 'CASINO',
    footprint: { x: 12, y: 22, w: 16, h: 14 },
    entrance: { x: 22, y: 22 },
    interiorLayoutId: 'layout_casino_grand',
    operatingHours: { openHour: 14, closeHour: 6 },
    locked: false,
  }),
]);
