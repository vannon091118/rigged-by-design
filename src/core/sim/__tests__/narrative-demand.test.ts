/**
 * @test-target: src/core/sim/narrative/demand-events.ts
 * @error-code: ERR-2001
 *
 * Nachfrageveranstaltungen laufen als aktive GLOBAL-Event-Instanzen; die
 * Nachfragewirkung wird daraus abgeleitet, nicht aus einem zweiten Feld.
 */
import { describe, expect, it } from 'vitest';
import { demandBreakdown } from '../demand';
import { activeDemand, activeDemandEvent, startDemandEvent } from '../narrative/demand-events';
import { maintainEvents } from '../narrative/event-scheduler';
import { templateFor } from '../narrative/events/definitions';
import { DEMAND_EVENT_DEFINITIONS, isDemandEventId } from '../narrative/events/demand-definitions';
import { createWorld } from '../templates';

function setup() {
  return createWorld('SMALL');
}

describe('Nachfrageevent-Definitionen', () => {
  it('haelt beide Veranstaltungen mit unveraenderter Wirkung und Laufzeit bereit', () => {
    expect(DEMAND_EVENT_DEFINITIONS.NEON_NACHT.perDay).toBe(20);
    expect(DEMAND_EVENT_DEFINITIONS.TURNIER_ABEND.perDay).toBe(16);
    for (const definition of Object.values(DEMAND_EVENT_DEFINITIONS)) {
      expect(definition.durationTicks).toBe(150);
      expect(definition.groupChance).toBe(0.55);
      expect(definition.groupMean).toBe(0.55);
      expect(definition.startMessage.length).toBeGreaterThan(0);
    }
    expect(isDemandEventId('NEON_NACHT')).toBe(true);
    expect(isDemandEventId('TURNIER_ABEND')).toBe(true);
    expect(isDemandEventId('SAVE_EVENT')).toBe(false);
  });
});

describe('Nachfrageevent-Lifecycle', () => {
  it('startet als aktive GLOBAL-Instanz mit Frist und ohne Choices', () => {
    const world = setup();
    world.tick = 700;
    const event = startDemandEvent(world, 'NEON_NACHT');
    expect(event).not.toBeNull();
    expect(event!.status).toBe('ACTIVE');
    expect(event!.scope).toBe('GLOBAL');
    expect(event!.eventId).toBe('NEON_NACHT');
    expect(event!.expiresTick).toBe(850);
    expect(event!.offeredChoiceIds).toEqual([]);
    expect(activeDemandEvent(world)?.id).toBe(event!.id);
    expect(activeDemand(world)?.kind).toBe('NEON_NACHT');
  });

  it('zeigt auf ein aufloesbares Template statt auf eine freie ID', () => {
    const world = setup();
    const event = startDemandEvent(world, 'NEON_NACHT');
    expect(event).not.toBeNull();
    const template = templateFor(event!.templateId, event!.templateVersion);
    expect(template?.eventId).toBe('NEON_NACHT');
    expect(template?.choices).toEqual([]);
  });

  it('startet keine zweite Veranstaltung, solange eine laeuft', () => {
    const world = setup();
    expect(startDemandEvent(world, 'NEON_NACHT')).not.toBeNull();
    expect(startDemandEvent(world, 'TURNIER_ABEND')).toBeNull();
    expect(activeDemand(world)?.kind).toBe('NEON_NACHT');
    expect(world.narrative.events.filter((event) => event.status === 'ACTIVE')).toHaveLength(1);
  });

  it('leitet Anzeige und Nachfragequelle aus der aktiven Instanz ab', () => {
    const world = setup();
    world.tick = 700;
    startDemandEvent(world, 'TURNIER_ABEND');
    const snapshot = demandBreakdown(world);
    expect(snapshot.event).toEqual({ kind: 'TURNIER_ABEND', label: 'Turnierabend', ticksLeft: 150 });
    expect(snapshot.sources.find((source) => source.id === 'EVENT')?.perDay).toBe(16);
    world.tick = 800;
    expect(demandBreakdown(world).event?.ticksLeft).toBe(50);
  });

  it('beendet die Veranstaltung erst am Fristtick und liefert die Instanz', () => {
    const world = setup();
    world.tick = 700;
    startDemandEvent(world, 'NEON_NACHT');
    world.tick = 849;
    expect(maintainEvents(world).expired).toEqual([]);
    expect(activeDemand(world)?.kind).toBe('NEON_NACHT');
    world.tick = 850;
    const { expired } = maintainEvents(world);
    expect(expired.map((event) => event.eventId)).toEqual(['NEON_NACHT']);
    expect(activeDemandEvent(world)).toBeNull();
    const ended = world.narrative.events.find((event) => event.eventId === 'NEON_NACHT')!;
    expect(ended.status).toBe('EXPIRED');
    expect(ended.resolution).toBe('DEADLINE');
    expect(demandBreakdown(world).sources.some((source) => source.id === 'EVENT')).toBe(false);
    expect(demandBreakdown(world).event).toBeNull();
  });
});
