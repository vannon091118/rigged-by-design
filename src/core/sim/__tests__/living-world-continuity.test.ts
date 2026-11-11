/**
 * @test-target: src/core/sim/actor-continuity.ts
 * @error-code: ERR-2001
 */
import { describe, expect, it } from 'vitest';
import {
  type ActorContinuityRecord,
  createActorContinuityRecord,
  syncActorSpatialLOD,
  transferActorAcrossDoor,
} from '../actor-continuity';
import { createBuilding, isBuildingOpen } from '../building';
import { createCityExteriorModel } from '../city-exterior';
import { nextIntentForHour } from '../npc-schedule';
import { createPlayerApartmentModel } from '../player-apartment';
import { createConnectedDoorPair, transitionActorThroughDoor } from '../room-transition';

describe('Living World Continuity — Raumuebergang und Identitaetserhalt', () => {
  it('startet den Spieler in seiner Wohnung und erlaubt Uebertritt auf die Strasse', () => {
    const apt = createPlayerApartmentModel();
    expect(apt.layout.zones.length).toBe(5);
    expect(apt.furniture.some((f) => f.kind === 'BED')).toBe(true);

    const { exitDoor: aptExitDoor } = createConnectedDoorPair({
      id: 'apt_player_door',
      label: 'Haustuer Wohnung',
      interiorBuildingId: 'apt_player',
      interiorLayoutId: 'layout_player_apartment',
      interiorDoorPos: { x: 9, y: 5 },
      exteriorLayoutId: 'layout_city_exterior',
      exteriorDoorPos: { x: 8, y: 12 },
    });

    const player: ActorContinuityRecord = createActorContinuityRecord({
      actorId: 'player_main',
      name: 'Spieler',
      currentContext: 'INTERIOR',
      buildingId: 'apt_player',
      position: { x: 2, y: 3 },
    });

    expect(player.currentContext).toBe('INTERIOR');
    expect(player.buildingId).toBe('apt_player');

    // Spieler laeuft zur Tuer und tritt auf die Strasse hinaus
    const playerAtStreet = transferActorAcrossDoor(player, aptExitDoor);
    expect(playerAtStreet.currentContext).toBe('EXTERIOR');
    expect(playerAtStreet.buildingId).toBeNull();
    expect(playerAtStreet.position.x).toBe(8);
    expect(playerAtStreet.position.y).toBe(12);
  });

  it('bewahrt die exakte Identitaet und Beduerfnisse eines NPCs beim Gebaeudebetritt', () => {
    const city = createCityExteriorModel();
    expect(city.buildings.length).toBe(4);
    const pubBuilding = createBuilding({
      id: 'bld_pub_01',
      name: 'Zur Goldenen Muetze',
      kind: 'PUB',
      interiorLayoutId: 'layout_pub_01',
      entrance: { x: 24, y: 10 },
      footprint: { x: 22, y: 6, w: 8, h: 6 },
    });
    expect(isBuildingOpen(pubBuilding, 20)).toBe(true);

    const { enterDoor: pubEnterDoor, exitDoor: pubExitDoor } = createConnectedDoorPair({
      id: 'pub_entrance',
      label: 'Kneipe Eingang',
      interiorBuildingId: 'bld_pub_01',
      interiorLayoutId: 'layout_pub_01',
      interiorDoorPos: { x: 2, y: 8 },
      exteriorLayoutId: 'layout_city_exterior',
      exteriorDoorPos: { x: 24, y: 11 },
    });

    // NPC Rita laeuft laut Plan ab 19:00 Uhr in die Kneipe
    const ritaStreet = createActorContinuityRecord({
      actorId: 'npc_rita',
      name: 'Rita',
      currentContext: 'EXTERIOR',
      position: { x: 23, y: 11 },
      needs: { hunger: 45, social: 70, fatigue: 30, money: 3200, mood: 60 },
      inventory: ['house_key', 'wallet'],
    });

    const currentRitaIntent = nextIntentForHour(ritaStreet.dayPlan, 19);
    expect(currentRitaIntent?.intent).toBe('PUB');

    // Rita tritt durch die Kneipentuer
    const ritaInside = transferActorAcrossDoor(ritaStreet, pubEnterDoor);
    expect(ritaInside.currentContext).toBe('INTERIOR');
    expect(ritaInside.buildingId).toBe('bld_pub_01');
    expect(ritaInside.position.x).toBe(2);
    expect(ritaInside.position.y).toBe(8);

    // KERN-INVARIANTE: Dieselbe Instanz ohne Verlust von Beduerfnissen oder Inventar
    expect(ritaInside.actorId).toBe('npc_rita');
    expect(ritaInside.needs.hunger).toBe(45);
    expect(ritaInside.needs.social).toBe(70);
    expect(ritaInside.needs.money).toBe(3200);
    expect(ritaInside.inventory).toEqual(['house_key', 'wallet']);

    // Spieler folgt Rita durch dieselbe Tuer in denselben Innenraum
    const transitionResult = transitionActorThroughDoor(
      {
        id: 'player_main',
        name: 'Spieler',
        location: {
          context: 'EXTERIOR',
          buildingId: null,
          layoutId: 'layout_city_exterior',
          position: { x: 24, y: 11 },
        },
      },
      pubEnterDoor,
      [pubBuilding]
    );
    expect(transitionResult.success).toBe(true);
    expect(transitionResult.actor.location.context).toBe('INTERIOR');
    expect(transitionResult.actor.location.buildingId).toBe('bld_pub_01');

    // NPC kann den Raum spaeter wieder verlassen
    const ritaExits = transferActorAcrossDoor(ritaInside, pubExitDoor);
    expect(ritaExits.currentContext).toBe('EXTERIOR');
    expect(ritaExits.buildingId).toBeNull();
  });

  it('passt LOD-Stufen deterministisch an die relative Naehe zum Spieler an', () => {
    const npc = createActorContinuityRecord({
      actorId: 'npc_markus',
      name: 'Markus',
      currentContext: 'EXTERIOR',
      position: { x: 10, y: 10 },
    });

    // Spieler weit entfernt in anderem Kontext -> ABSTRACT
    const lodFar = syncActorSpatialLOD(npc, 'INTERIOR', { x: 2, y: 3 });
    expect(lodFar.lodLevel).toBe('ABSTRACT');

    // Spieler im selben Kontext, Distanz ~5 Fliesen -> ACTIVE
    const lodNear = syncActorSpatialLOD(npc, 'EXTERIOR', { x: 13, y: 14 });
    expect(lodNear.lodLevel).toBe('ACTIVE');

    // Spieler im selben Kontext, Distanz ~30 Fliesen -> NEIGHBORHOOD
    const lodMid = syncActorSpatialLOD(npc, 'EXTERIOR', { x: 40, y: 10 });
    expect(lodMid.lodLevel).toBe('NEIGHBORHOOD');
  });
});
