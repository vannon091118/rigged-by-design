/**
 * @test-target: src/core/sim/social-encounter.ts
 * @error-code: ERR-3001
 */
import { describe, expect, it } from 'vitest';
import { createActorContinuityRecord } from '../actor-continuity';
import { needsOverrideIntent, tickNeeds } from '../npc-needs';
import { nextIntentForHour, resolveNpcIntent } from '../npc-schedule';
import {
  canInitiateEncounter,
  executeServiceTransaction,
  executeSocialConversation,
  type ServiceTransactionResult,
  SOCIAL_INTERACTION_RADIUS,
  type SocialEncounterResult,
} from '../social-encounter';

describe('Living World Social & Economy — Wechselseitige System-Interaktion', () => {
  it('erkennt physische Interaktionsreichweite korrekt', () => {
    expect(SOCIAL_INTERACTION_RADIUS).toBe(2.5);
    const posA = { x: 5, y: 5 };
    const posNear = { x: 6, y: 6 };
    const posFar = { x: 10, y: 10 };

    expect(canInitiateEncounter(posA, posNear)).toBe(true);
    expect(canInitiateEncounter(posA, posFar)).toBe(false);
  });

  it('fuehrt Gespraeche mit wechselseitiger Auswirkung auf Beduerfnisse und Beziehung', () => {
    const player = createActorContinuityRecord({
      actorId: 'player_main',
      name: 'Spieler',
      currentContext: 'INTERIOR',
      buildingId: 'bld_pub_01',
      position: { x: 5, y: 5 },
      needs: { social: 60, mood: 70 },
    });

    const rita = createActorContinuityRecord({
      actorId: 'npc_rita',
      name: 'Rita',
      currentContext: 'INTERIOR',
      buildingId: 'bld_pub_01',
      position: { x: 6, y: 5 },
      needs: { social: 80, mood: 50 },
    });

    const encounter: SocialEncounterResult = executeSocialConversation(player, rita, 'Die neuen Nachbarn');

    // Beide Akteure werden durch das Gespraech beeinflusst
    expect(encounter.initiator.needs.social).toBe(40);
    expect(encounter.initiator.needs.mood).toBe(80);
    expect(encounter.initiator.relationships['npc_rita']).toBe(10);

    expect(encounter.respondent.needs.social).toBe(55);
    expect(encounter.respondent.needs.mood).toBe(60);
    expect(encounter.respondent.relationships['player_main']).toBe(10);

    // Kausale Dokumentation fuer den Ereignisstrom
    expect(encounter.relationshipDelta).toBe(10);
    expect(encounter.factDescription).toContain('Gespraech zwischen Spieler und Rita');
  });

  it('bucht Konsum ueber den Ledger ab und stillt Beduerfnisse ganzheitlich', () => {
    const customer = createActorContinuityRecord({
      actorId: 'npc_rita',
      name: 'Rita',
      currentContext: 'INTERIOR',
      buildingId: 'bld_pub_01',
      needs: { money: 5000, hunger: 60, mood: 60 },
    });

    // Rita bestellt einen Haustrunk fuer 450 Mikro-VaCoins
    const txResult: ServiceTransactionResult = executeServiceTransaction(customer, 'bld_pub_01', 450, 'drink');

    // Beduerfnisse und Geld aktualisiert
    expect(txResult.updatedCustomer.needs.money).toBe(4550);
    expect(txResult.updatedCustomer.needs.hunger).toBe(30);
    expect(txResult.updatedCustomer.needs.mood).toBe(68);

    // Ledger-Buchungseintrag entspricht den Integritaetsregeln
    expect(txResult.ledgerEntry.fromAccount).toBe('actor:npc_rita');
    expect(txResult.ledgerEntry.toAccount).toBe('venue:bld_pub_01');
    expect(txResult.ledgerEntry.amountMicro).toBe(450);
    expect(txResult.ledgerEntry.reason).toBe('PURCHASE_DRINK');
  });

  it('schliesst den Kreis: Beduerfnis-Akkumulation fuehrt zu dynamischer Heimkehr', () => {
    const rita = createActorContinuityRecord({
      actorId: 'npc_rita',
      name: 'Rita',
      currentContext: 'INTERIOR',
      buildingId: 'bld_pub_01',
      needs: { fatigue: 60, hunger: 20, social: 20 },
    });

    // Nach 4 Stunden in der Kneipe: Muedigkeit steigt massiv an
    const tiredRitaNeeds = tickNeeds(rita.needs, 'PUB', 4);
    expect(tiredRitaNeeds.fatigue).toBe(76);

    // Bei fortgeschrittener Nacht (23:00) greift der Schlafens-Intent
    const scheduledIntent = nextIntentForHour(rita.dayPlan, 23);
    expect(scheduledIntent?.intent).toBe('SLEEP');

    const resolved = resolveNpcIntent(tiredRitaNeeds, scheduledIntent!, 23);
    expect(resolved.kind).toBe('SLEEP');
    expect(resolved.targetBuildingId).toBe('apt_player');

    // Bei extremer Erschoepfung wuerde auch eine fruehere Heimkehr erzwungen
    const exhaustedNeeds = { ...tiredRitaNeeds, fatigue: 95 };
    expect(needsOverrideIntent(exhaustedNeeds)).toBe('SLEEP');
  });
});
