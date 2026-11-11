/**
 * @test-target: src/core/sim/actor-continuity.ts
 * @error-code: ERR-2001
 *
 * Bundle 6: End-to-End Vertical Slice der Living World Engine.
 * Verifiziert das nahtlose Zusammenspiel aller Teilsysteme:
 * - Wohnung -> Haustuer -> Strasse -> Kneipe
 * - Autonome Schedule-Intents & dynamische Beduerfnisse
 * - Raum- und Akteurskontinuitaet ohne Duplikate
 * - Physische Begegnung & Konversation
 * - Ledger-gebuchte Konsumtransaktion
 * - Reaktives visuelles Feedback mit Raumfilterung
 */
import { describe, expect, it } from 'vitest';
import {
  type ActorContinuityRecord,
  createActorContinuityRecord,
  transferActorAcrossDoor,
} from '../actor-continuity';
import { createBuilding, canActorEnterBuilding, isBuildingOpen, updateBuildingOccupancy } from '../building';
import { tickNeeds } from '../npc-needs';
import { nextIntentForHour, resolveNpcIntent } from '../npc-schedule';
import { createPlayerApartmentModel } from '../player-apartment';
import { createConnectedDoorPair } from '../room-transition';
import {
  canInitiateEncounter,
  executeServiceTransaction,
  executeSocialConversation,
} from '../social-encounter';
import {
  createReactionForAction,
  shouldShowReaction,
} from '../../../render/reaction-feedback';

describe('Living World Engine — Bundle 6 Vertical Slice', () => {
  it('fuehrt das vollstaendige End-to-End Abnahmeszenario erfolgreich durch', () => {
    // 1. Spieler startet in eigener Wohnung
    const apt = createPlayerApartmentModel();
    expect(apt.layoutId).toBe('layout_player_apartment');

    let player: ActorContinuityRecord = createActorContinuityRecord({
      actorId: 'player_main',
      name: 'Spieler',
      currentContext: 'INTERIOR',
      buildingId: 'apt_player',
      position: { x: 3, y: 4 },
      needs: { hunger: 20, social: 70, fatigue: 10, money: 10000, mood: 50 },
    });
    expect(player.currentContext).toBe('INTERIOR');

    // 2. Smartphone-Nachricht trifft ein: visuelles Feedback
    const phoneCue = createReactionForAction('PHONE_GLOW', player.actorId, player.position);
    expect(phoneCue.kind).toBe('PHONE_GLOW');
    expect(
      shouldShowReaction(
        { spatialContext: 'INTERIOR', layoutId: 'layout_player_apartment' },
        { spatialContext: 'INTERIOR', layoutId: 'layout_player_apartment' },
      ),
    ).toBe(true);

    // 3. Spieler geht zur Haustuer und tritt auf die Strasse
    const { exitDoor: aptExitDoor } = createConnectedDoorPair({
      id: 'door_apt_player',
      label: 'Haustuer Wohnung',
      interiorBuildingId: 'apt_player',
      interiorLayoutId: 'layout_player_apartment',
      interiorDoorPos: { x: 9, y: 5 },
      exteriorLayoutId: 'layout_city_exterior',
      exteriorDoorPos: { x: 8, y: 12 },
    });

    const doorOpenCue = createReactionForAction('DOOR_OPEN', null, { x: 9, y: 5 });
    expect(doorOpenCue.kind).toBe('DOOR_OPEN');

    player = transferActorAcrossDoor(player, aptExitDoor);
    expect(player.currentContext).toBe('EXTERIOR');
    expect(player.buildingId).toBeNull();
    expect(player.position).toEqual({ x: 8, y: 12 });

    // 4. Nachbar Rita folgt ihrem Schedule Richtung Kneipe
    let pub = createBuilding({
      id: 'bld_pub_01',
      name: 'Kiezkneipe Zum Nagel',
      kind: 'PUB',
      interiorLayoutId: 'layout_pub_01',
      entrance: { x: 24, y: 10 },
      footprint: { x: 20, y: 8, w: 8, h: 6 },
      operatingHours: { openHour: 16, closeHour: 2 },
    });
    expect(isBuildingOpen(pub, 19)).toBe(true);

    let rita: ActorContinuityRecord = createActorContinuityRecord({
      actorId: 'npc_rita',
      name: 'Rita',
      currentContext: 'EXTERIOR',
      position: { x: 22, y: 10 },
      needs: { hunger: 55, social: 75, fatigue: 25, money: 4000, mood: 45 },
    });

    const ritaIntent = nextIntentForHour(rita.dayPlan, 19);
    expect(ritaIntent?.intent).toBe('PUB');

    // 5. Rita betritt die Kneipe, Spieler folgt ihr
    const { enterDoor: pubEnterDoor } = createConnectedDoorPair({
      id: 'door_pub_01',
      label: 'Eingang Kiezkneipe',
      interiorBuildingId: pub.id,
      interiorLayoutId: pub.interiorLayoutId,
      interiorDoorPos: { x: 2, y: 8 },
      exteriorLayoutId: 'layout_city_exterior',
      exteriorDoorPos: pub.entrance,
    });

    expect(canActorEnterBuilding(pub, rita.actorId, 19)).toBe(true);
    pub = updateBuildingOccupancy(pub, 1);
    expect(pub.occupancy).toBe(1);

    rita = transferActorAcrossDoor(rita, pubEnterDoor);
    expect(rita.currentContext).toBe('INTERIOR');
    expect(rita.buildingId).toBe(pub.id);

    // KERN-INVARIANTE: Keine Duplikate, Daten bleiben exakt identisch
    expect(rita.actorId).toBe('npc_rita');
    expect(rita.needs.hunger).toBe(55);
    expect(rita.needs.money).toBe(4000);

    // Spieler betritt nun dieselbe Kneipe
    expect(canActorEnterBuilding(pub, player.actorId, 19)).toBe(true);
    pub = updateBuildingOccupancy(pub, 1);
    player = transferActorAcrossDoor(player, pubEnterDoor);
    player = { ...player, position: { x: 3, y: 8 } };
    expect(player.currentContext).toBe('INTERIOR');
    expect(player.buildingId).toBe(pub.id);

    // 6. Physische Begegnung & Gespraech
    expect(canInitiateEncounter(player.position, rita.position)).toBe(true);

    const encounter = executeSocialConversation(player, rita, 'Kiez-Gespraech');
    player = encounter.initiator;
    rita = encounter.respondent;

    expect(player.needs.social).toBe(50);
    expect(player.needs.mood).toBe(60);
    expect(player.relationships[rita.actorId]).toBe(10);
    expect(rita.needs.social).toBe(50);
    expect(rita.relationships[player.actorId]).toBe(10);

    const talkCue = createReactionForAction('HEAD_TURN', rita.actorId, rita.position);
    expect(talkCue.kind).toBe('HEAD_TURN');

    // 7. Konsum ueber Ledger (Haustrunk fuer 350 Mikro-VaCoins)
    const tx = executeServiceTransaction(rita, pub.id, 350, 'drink');
    rita = tx.updatedCustomer;

    expect(rita.needs.money).toBe(3650);
    expect(rita.needs.hunger).toBe(25);
    expect(tx.ledgerEntry.amountMicro).toBe(350);
    expect(tx.ledgerEntry.fromAccount).toBe('actor:npc_rita');
    expect(tx.ledgerEntry.toAccount).toBe('venue:bld_pub_01');

    // 8. Zeit verstreicht: Muedigkeit fuehrt zu dynamischer Intent-Aenderung (Heimkehr)
    // Rita hatte nach Transaktion: fatigue=25, PUB tickt +4/h -> nach 5h: 25+20=45
    // Damit der Schlaf-Override greift (fatigue>=90), brauchen wir mehr Stunden
    // 25 + 4*17 = 25 + 68 = 93 >= 90 -> Override zu SLEEP
    const lateNeeds = tickNeeds(rita.needs, 'PUB', 17);
    expect(lateNeeds.fatigue).toBeGreaterThanOrEqual(90);
    const scheduledEntry = nextIntentForHour(rita.dayPlan, 23)!;
    const dynamicIntent = resolveNpcIntent(lateNeeds, scheduledEntry, 23);
    expect(dynamicIntent.kind).toBe('SLEEP');
  });
});
