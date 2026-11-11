import { describe, expect, it } from 'vitest';
import { CITY_PRESET_BUILDINGS } from '../building';
import { createCityExteriorModel } from '../city-exterior';
import { createPlayerApartmentModel } from '../player-apartment';
import {
  createConnectedDoorPair,
  type SpatialActor,
  transitionActorThroughDoor,
} from '../room-transition';

describe('Living World: Room & Building Transition', () => {
  it('erzeugt Spieler-Wohnung mit allen Funktionsbereichen', () => {
    const apt = createPlayerApartmentModel();
    expect(apt.name).toBe('Wohnung des Spielers');
    expect(apt.layout.size).toBe(30);
    expect(apt.layout.zones.length).toBeGreaterThanOrEqual(4);
    expect(apt.furniture.some((f) => f.kind === 'BED')).toBe(true);
    expect(apt.furniture.some((f) => f.kind === 'SMARTPHONE')).toBe(true);
    expect(apt.furniture.some((f) => f.kind === 'FRIDGE')).toBe(true);
    expect(apt.furniture.some((f) => f.kind === 'TOILET')).toBe(true);
  });

  it('erzeugt Kiez-Aussenwelt mit Strassen und Gebaeuden', () => {
    const exterior = createCityExteriorModel();
    expect(exterior.layout.size).toBe(60);
    expect(exterior.buildings.length).toBe(4);
    expect(exterior.props.length).toBeGreaterThan(0);
    expect(exterior.layout.zones.some((z) => z.id === 'ext_zone_main_street')).toBe(true);
  });

  it('fuehrt Akteur nahtlos von der Wohnung auf die Strasse', () => {
    const { exitDoor } = createConnectedDoorPair({
      id: 'apt_main_exit',
      label: 'Haustür',
      interiorBuildingId: 'bld_player_home',
      interiorLayoutId: 'layout_player_apartment',
      interiorDoorPos: { x: 22, y: 25 },
      exteriorLayoutId: 'layout_city_street_quarter',
      exteriorDoorPos: { x: 8, y: 12 },
    });

    const player: SpatialActor = {
      id: 'PLAYER',
      name: 'Spieler',
      location: {
        context: 'INTERIOR',
        buildingId: 'bld_player_home',
        layoutId: 'layout_player_apartment',
        position: { x: 22, y: 24 }, // direkt vor der Tür (Distanz 1)
      },
    };

    // Wohnungsbelegung vorher simulieren: 1
    const buildingsWithPlayer = CITY_PRESET_BUILDINGS.map((b) =>
      b.id === 'bld_player_home' ? { ...b, occupancy: 1 } : b,
    );

    const result = transitionActorThroughDoor(player, exitDoor, buildingsWithPlayer);

    expect(result.success).toBe(true);
    expect(result.actor.location.context).toBe('EXTERIOR');
    expect(result.actor.location.buildingId).toBe(null);
    expect(result.actor.location.layoutId).toBe('layout_city_street_quarter');
    expect(result.actor.location.position).toEqual({ x: 8, y: 12 });

    // Spieler-Identität und Name bleiben unberührt
    expect(result.actor.id).toBe('PLAYER');
    expect(result.actor.name).toBe('Spieler');

    // Belegung der Wohnung wurde dekrementiert
    const homeAfter = result.updatedBuildings.find((b) => b.id === 'bld_player_home');
    expect(homeAfter?.occupancy).toBe(0);
  });

  it('fuehrt Akteur von der Strasse in die Kiezkneipe und erhoeht Belegung', () => {
    const { enterDoor } = createConnectedDoorPair({
      id: 'kiez_pub_entrance',
      label: 'Kneipeneingang',
      interiorBuildingId: 'bld_kiez_pub',
      interiorLayoutId: 'layout_kiez_pub',
      interiorDoorPos: { x: 10, y: 20 },
      exteriorLayoutId: 'layout_city_street_quarter',
      exteriorDoorPos: { x: 24, y: 14 },
    });

    const npc: SpatialActor = {
      id: 'npc_stammnutzer_klaus',
      name: 'Klaus',
      location: {
        context: 'EXTERIOR',
        buildingId: null,
        layoutId: 'layout_city_street_quarter',
        position: { x: 24, y: 13 }, // direkt vor dem Kneipeneingang
      },
    };

    const result = transitionActorThroughDoor(npc, enterDoor, CITY_PRESET_BUILDINGS);

    expect(result.success).toBe(true);
    expect(result.actor.location.context).toBe('INTERIOR');
    expect(result.actor.location.buildingId).toBe('bld_kiez_pub');
    expect(result.actor.location.layoutId).toBe('layout_kiez_pub');
    expect(result.actor.location.position).toEqual({ x: 10, y: 20 });

    const pubAfter = result.updatedBuildings.find((b) => b.id === 'bld_kiez_pub');
    expect(pubAfter?.occupancy).toBe(1);
  });

  it('blockiert Uebergang bei zu grosser Distanz oder verschlossener Tuer', () => {
    const { enterDoor } = createConnectedDoorPair({
      id: 'kiez_pub_entrance',
      label: 'Kneipeneingang',
      interiorBuildingId: 'bld_kiez_pub',
      interiorLayoutId: 'layout_kiez_pub',
      interiorDoorPos: { x: 10, y: 20 },
      exteriorLayoutId: 'layout_city_street_quarter',
      exteriorDoorPos: { x: 24, y: 14 },
      locked: true,
    });

    // Fall 1: Zu weit weg
    const farActor: SpatialActor = {
      id: 'far',
      name: 'Weit Weg',
      location: {
        context: 'EXTERIOR',
        buildingId: null,
        layoutId: 'layout_city_street_quarter',
        position: { x: 0, y: 0 },
      },
    };
    const resFar = transitionActorThroughDoor(farActor, enterDoor, CITY_PRESET_BUILDINGS);
    expect(resFar.success).toBe(false);
    expect(resFar.reason).toBe('NOT_NEAR_DOOR');

    // Fall 2: Nah dran, aber Tür ist verriegelt
    const nearActor: SpatialActor = {
      id: 'near',
      name: 'Nah Dran',
      location: {
        context: 'EXTERIOR',
        buildingId: null,
        layoutId: 'layout_city_street_quarter',
        position: { x: 24, y: 14 },
      },
    };
    const resLocked = transitionActorThroughDoor(nearActor, enterDoor, CITY_PRESET_BUILDINGS);
    expect(resLocked.success).toBe(false);
    expect(resLocked.reason).toBe('DOOR_LOCKED');

    // Mit Master-Schlüssel / Brecheisen (ignoreLock) geht es trotzdem
    const resUnlocked = transitionActorThroughDoor(nearActor, enterDoor, CITY_PRESET_BUILDINGS, {
      ignoreLock: true,
    });
    expect(resUnlocked.success).toBe(true);
  });
});
