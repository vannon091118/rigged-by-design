/**
 * Nahtlose Raum- und Gebäudeübergänge für Akteure (Spieler und NPCs).
 *
 * Ein Gebäudewechsel schaltet den räumlichen Fokus um, ohne den Spielzustand
 * zu verwerfen oder Akteure künstlich neu zu instanziieren.
 * Identität, Inventar, Beziehungen und Statuswerte bleiben exakt erhalten.
 */
import { updateBuildingOccupancy } from './building';
import type { BuildingState } from './building-types';
import type { Point } from './types-model';

/** Art des räumlichen Kontexts: im Freien (Straße) oder im Gebäudeinnenraum. */
export type SpatialContextKind = 'EXTERIOR' | 'INTERIOR';

/** Räumlicher Aufenthaltsort eines Akteurs. */
export interface SpatialLocation {
  /** Ob sich der Akteur auf der Straße oder in einem Gebäude befindet. */
  readonly context: SpatialContextKind;
  /** Gebäude-ID, falls context === 'INTERIOR', sonst null. */
  readonly buildingId: string | null;
  /** Zugeordnete Layout-ID des aktuellen Raums/Bereichs. */
  readonly layoutId: string;
  /** Exakte Koordinaten auf dem aktuellen Raster. */
  readonly position: Point;
}

/** Definition eines Übergangspunkts (Tür, Tor, Portal). */
export interface TransitionDoor {
  readonly id: string;
  readonly label: string;
  /** Ausgangsort des Übergangs. */
  readonly sourceContext: SpatialContextKind;
  readonly sourceBuildingId: string | null;
  readonly sourceLayoutId: string;
  readonly sourcePosition: Point;
  /** Zielort des Übergangs. */
  readonly targetContext: SpatialContextKind;
  readonly targetBuildingId: string | null;
  readonly targetLayoutId: string;
  readonly targetPosition: Point;
  /** Schlüssel erforderlich oder verriegelt. */
  readonly locked: boolean;
}

/** Akteur mit räumlicher Lokalisierung für Übergänge. */
export interface SpatialActor {
  readonly id: string;
  readonly name: string;
  readonly location: SpatialLocation;
}

/** Ergebnis eines versuchten Raumübergangs. */
export interface TransitionResult<T extends SpatialActor> {
  readonly success: boolean;
  /** Der aktualisierte Akteur mit neuer Position und neuem Kontext (bei Erfolg). */
  readonly actor: T;
  /** Grund bei Fehlschlag (z.B. 'DOOR_LOCKED', 'WRONG_LOCATION'). */
  readonly reason?: 'DOOR_LOCKED' | 'NOT_NEAR_DOOR' | 'MISMATCHED_CONTEXT';
  /** Betroffene Gebäude mit angepasster Belegung (falls ein Innenraum betreten/verlassen wurde). */
  readonly updatedBuildings: readonly BuildingState[];
}

/** Maximale Distanz in Manhattan-Schritten, um eine Tür zu durchschreiten. */
export const DOOR_INTERACTION_RADIUS = 2;

function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Versucht, einen Akteur durch eine Übergangstür zu bewegen.
 * Pure Funktion: Gibt neuen Akteur und aktualisierte Gebäude zurück.
 */
export function transitionActorThroughDoor<T extends SpatialActor>(
  actor: T,
  door: TransitionDoor,
  buildings: readonly BuildingState[] = [],
  options: { readonly ignoreLock?: boolean } = {},
): TransitionResult<T> {
  // Kontext-Prüfung
  if (
    actor.location.context !== door.sourceContext ||
    actor.location.layoutId !== door.sourceLayoutId ||
    actor.location.buildingId !== door.sourceBuildingId
  ) {
    return {
      success: false,
      actor,
      reason: 'MISMATCHED_CONTEXT',
      updatedBuildings: buildings,
    };
  }

  // Näherungs-Prüfung
  const dist = manhattanDistance(actor.location.position, door.sourcePosition);
  if (dist > DOOR_INTERACTION_RADIUS) {
    return {
      success: false,
      actor,
      reason: 'NOT_NEAR_DOOR',
      updatedBuildings: buildings,
    };
  }

  // Verriegelungs-Prüfung
  if (door.locked && !options.ignoreLock) {
    return {
      success: false,
      actor,
      reason: 'DOOR_LOCKED',
      updatedBuildings: buildings,
    };
  }

  // Neuer räumlicher Zustand des Akteurs
  const nextLocation: SpatialLocation = Object.freeze({
    context: door.targetContext,
    buildingId: door.targetBuildingId,
    layoutId: door.targetLayoutId,
    position: Object.freeze({ ...door.targetPosition }),
  });

  const nextActor: T = Object.freeze({
    ...actor,
    location: nextLocation,
  });

  // Belegungszahlen anpassen
  let updatedBuildings = buildings;
  if (door.sourceBuildingId && door.targetContext === 'EXTERIOR') {
    // Gebäude verlassen -> Occupancy -1
    updatedBuildings = updatedBuildings.map((b) =>
      b.id === door.sourceBuildingId ? updateBuildingOccupancy(b, -1) : b,
    );
  }
  if (door.targetBuildingId && door.sourceContext === 'EXTERIOR') {
    // Gebäude betreten -> Occupancy +1
    updatedBuildings = updatedBuildings.map((b) =>
      b.id === door.targetBuildingId ? updateBuildingOccupancy(b, 1) : b,
    );
  }

  return {
    success: true,
    actor: nextActor,
    updatedBuildings: Object.freeze(updatedBuildings),
  };
}

/**
 * Erzeugt ein beidseitiges Paar verbundener Übergangstüren (Hin- und Rückweg).
 */
export function createConnectedDoorPair(params: {
  readonly id: string;
  readonly label: string;
  readonly interiorBuildingId: string;
  readonly interiorLayoutId: string;
  readonly interiorDoorPos: Point;
  readonly exteriorLayoutId: string;
  readonly exteriorDoorPos: Point;
  readonly locked?: boolean;
}): { readonly enterDoor: TransitionDoor; readonly exitDoor: TransitionDoor } {
  const enterDoor: TransitionDoor = Object.freeze({
    id: `enter_${params.id}`,
    label: `${params.label} betreten`,
    sourceContext: 'EXTERIOR',
    sourceBuildingId: null,
    sourceLayoutId: params.exteriorLayoutId,
    sourcePosition: Object.freeze({ ...params.exteriorDoorPos }),
    targetContext: 'INTERIOR',
    targetBuildingId: params.interiorBuildingId,
    targetLayoutId: params.interiorLayoutId,
    targetPosition: Object.freeze({ ...params.interiorDoorPos }),
    locked: params.locked ?? false,
  });

  const exitDoor: TransitionDoor = Object.freeze({
    id: `exit_${params.id}`,
    label: `${params.label} verlassen`,
    sourceContext: 'INTERIOR',
    sourceBuildingId: params.interiorBuildingId,
    sourceLayoutId: params.interiorLayoutId,
    sourcePosition: Object.freeze({ ...params.interiorDoorPos }),
    targetContext: 'EXTERIOR',
    targetBuildingId: null,
    targetLayoutId: params.exteriorLayoutId,
    targetPosition: Object.freeze({ ...params.exteriorDoorPos }),
    locked: params.locked ?? false,
  });

  return { enterDoor, exitDoor };
}
