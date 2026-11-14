/**
 * @module city-construction — Rohbau, Fertigstellung und Türen der Neubauten (S3)
 *
 * Ein Neubau ist zuerst ein Rohbau: versiegelt, ohne Türkante und ohne belegbare
 * Stellen. Am Folgetag schliesst der Übergang den Bau: die Wände bekommen die
 * vorgesehene Türöffnung, die `DOOR`-Kante entsteht, `locked` fällt und die
 * Stellen werden belegbar. Der Zustand steht am Gebäude und überlebt das Save.
 *
 * Die Fertigstellung läuft genau einmal pro Rohbau und Tag; jeder Übergang
 * schreibt ein Journal-Ereignis, damit der Bau nicht unsichtbar passiert.
 */
import type { BuildingState } from './building-types';
import { JOB_CAPACITY } from './city-employment';
import { cityBuildingWalls } from './city-exterior';
import { plotAtRect } from './city-plots';
import { recordJournal } from './journal';
import type { EdgeAxis, LayoutEdge } from './layout-types';
import type { CityDoorEffect } from './city-network';
import type { WorldState } from './types';

/** Kennungen, die der Wachstumspfad erzeugt; nur sie werden fertiggestellt. */
const GROWN_PREFIX = 'bld_grown_';

/** Ein Rohbau ist eine Kulisse; erst die Fertigstellung macht ihn zum Ort. */
export function isShell(building: BuildingState): boolean {
  return building.construction === 'SHELL';
}

/** Die Tür eines Neubaus; die Kennung nennt das Gebäude, kein zweiter Index. */
export function grownDoorId(buildingId: string): string {
  return `door_grown_${buildingId}`;
}

/** Das Gebäude hinter einer Neubau-Tür; für Türklick und Eingangspfad. */
export function grownDoorBuilding(
  doorId: string,
  buildings: readonly BuildingState[],
): BuildingState | null {
  return buildings.find((building) => grownDoorId(building.id) === doorId) ?? null;
}

function doorAxis(building: BuildingState): EdgeAxis {
  const { x, y, w, h } = building.footprint;
  const { x: ex, y: ey } = building.entrance;
  return ey === y || ey === y + h ? 'H' : ex === x || ex === x + w ? 'V' : 'H';
}

function grownDoorEdge(building: BuildingState): LayoutEdge {
  return {
    axis: doorAxis(building),
    x: building.entrance.x,
    y: building.entrance.y,
    kind: 'DOOR',
    id: grownDoorId(building.id),
    zoneId: null,
  };
}

/** Wände aller Gebäude; Rohbauten bleiben ohne Öffnung, also ohne Tür. */
function wallsFor(buildings: readonly BuildingState[]): LayoutEdge[] {
  return cityBuildingWalls(buildings.map((building) => isShell(building)
    ? { ...building, entrance: { x: -1, y: -1 } }
    : building));
}

function journalCompletion(world: WorldState, building: BuildingState): void {
  const slots = JOB_CAPACITY[building.kind] ?? 0;
  const plot = plotAtRect(building.footprint);
  recordJournal(world, {
    kind: 'SYSTEM',
    subject: `Bau fertig: ${building.name}`,
    cause: `Rohbau seit Tag ${building.builtDay ?? 0}; Grundstück ${plot?.label ?? 'unbekannt'}.`,
    effect: slots > 0
      ? `${slots} Stellen belegbar; Zugang offen.`
      : 'Privatwohnung bezogen; kein öffentlicher Zugang.',
    refs: { buildingId: building.id },
  });
}

/**
 * Der Effekt einer fertigen Neubau-Tuer: der Laden fuehrt in die bestehende
 * Marktgasse, das Wohnhaus bleibt privat. Rohbau und gesperrter Bau: keiner.
 */
export function grownDoorEffect(building: BuildingState): CityDoorEffect | null {
  if (isShell(building) || building.locked) return null;
  if (building.kind === 'SHOP') return { kind: 'CITY_LOCATION', location: 'MARKT' };
  return null;
}

/**
 * Schliesst alle Rohbauten, die vor dem aktuellen Tag errichtet wurden: Öffnung
 * in der Wand, `DOOR`-Kante am Entrance, `locked` fällt, Zustand `OPEN`.
 * Liefert die fertiggestellten Gebäude; ein zweiter Lauf am selben Tag ist ein
 * No-Op, weil `construction` dann nicht mehr `SHELL` ist.
 */
export function completeCityConstruction(world: WorldState): readonly BuildingState[] {
  const scene = world.cityScene;
  if (!scene) return [];
  const buildings = scene.exterior.buildings;
  const due = buildings.filter((building) =>
    building.id.startsWith(GROWN_PREFIX) && isShell(building) && (building.builtDay ?? 0) < world.day);
  if (due.length === 0) return [];
  const opened = buildings.map((building) => due.includes(building)
    ? { ...building, construction: 'OPEN' as const, locked: false }
    : building);
  const doors = scene.layout.edges.filter((edge) => edge.kind === 'DOOR');
  const grownDoors = opened
    .filter((building) => building.id.startsWith(GROWN_PREFIX) && !isShell(building))
    .map(grownDoorEdge)
    .filter((door) => !doors.some((edge) => edge.id === door.id));
  world.cityScene = {
    ...scene,
    exterior: { ...scene.exterior, buildings: opened },
    layout: { ...scene.layout, edges: [...wallsFor(opened), ...doors, ...grownDoors] },
    zones: [...scene.zones],
    furniture: scene.furniture,
  };
  // Zurueck kommen die geoeffneten Gebaeude, nicht die alten Rohbau-Objekte:
  // der Aufrufer soll den neuen Zustand sehen, nicht den von eben (#524).
  const openedDue = opened.filter((building) => due.some((entry) => entry.id === building.id));
  for (const building of openedDue) journalCompletion(world, building);
  return openedDue;
}
