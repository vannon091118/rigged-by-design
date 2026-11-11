/**
 * @test-target: src/core/sim/venue-event.ts
 * @error-code: ERR-2001
 *
 * Die zentrale Event-Infrastruktur ist eine Projektion auf die vorhandene
 * NarrativeEventInstance: Ankuendigung, Einlass, Durchfuehrung, Ergebnis und
 * Archivierung muessen ohne zweites Save-Feld und ohne zweite Event-Liste aus
 * den echten Zustands- und Zeitfeldern folgen. Geprueft werden der Startpfad,
 * die Phasengrenzen, die Aufloesung im echten Tick, die einmalige Meldung und
 * die Kapazitaet aus dem vorhandenen Raumplan.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { activeDemandEvent } from '../narrative/demand-events';
import { roomPlanSummary, roomPlans } from '../room-plan';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import { openVenueEvent, tickVenueEvents, venueView } from '../venue-event';

function setup() {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  return { world, ledger: new Ledger(), prng: new Prng(randomSeed()) };
}

const endedJournal = (world: ReturnType<typeof setup>['world'], label: string) =>
  world.journal.filter((entry) => entry.subject === label && entry.cause === 'Veranstaltung beendet');

describe('Zentrale Event-Infrastruktur', () => {
  it('startet als Ankuendigung und liest die Kapazitaet aus dem vorhandenen Raumplan', () => {
    const { world } = setup();
    const event = openVenueEvent(world, 'TURNIER_ABEND');
    expect(event).not.toBeNull();
    expect(event!.step).toBe('ANNOUNCED');
    const view = venueView(world);
    expect(view.current).toMatchObject({
      kind: 'TURNIER_ABEND', label: 'Turnierabend', format: 'TURNIER',
      phase: 'ANNOUNCED', phaseLabel: 'Ankündigung',
    });
    expect(view.admitted).toBe(0);
    expect(view.capacity).toBe(roomPlanSummary(roomPlans(world.layout)).guestCapacity);
    expect(view.history).toEqual([]);
    expect(world.journal.filter((entry) => entry.cause === 'Veranstaltung angekündigt')).toHaveLength(1);
  });

  it('fuehrt Einlass, Durchfuehrung und Ergebnis an den Laufzeitgrenzen', () => {
    const { world } = setup();
    const event = openVenueEvent(world, 'TURNIER_ABEND')!;
    world.tick = 730;
    tickVenueEvents(world);
    expect(venueView(world).current).toMatchObject({ phase: 'ADMISSION', step: 'ADMISSION' });
    world.tick = 760;
    tickVenueEvents(world);
    expect(venueView(world).current).toMatchObject({ phase: 'RUNNING', step: 'RUNNING' });
    world.tick = 820;
    tickVenueEvents(world);
    expect(venueView(world).current).toMatchObject({ phase: 'RESULT', step: 'RESULT' });
    expect(world.narrative.events.find((entry) => entry.id === event.id)?.status).toBe('ACTIVE');
  });

  it('loest im echten Tick genau einmal auf und schreibt Ergebnis plus Journal', () => {
    const { world, ledger, prng } = setup();
    const event = openVenueEvent(world, 'NEON_NACHT')!;
    expect(activeDemandEvent(world)?.id).toBe(event.id);
    world.tick = 849;
    tickWorld(world, ledger, prng);
    expect(world.tick).toBe(850);
    const ended = world.narrative.events.find((entry) => entry.id === event.id)!;
    expect(activeDemandEvent(world)).toBeNull();
    expect(ended.status).toBe('RESOLVED');
    expect(ended.step).toBe('RESULT');
    expect(ended.resolution).toContain('Neon-Nacht');
    expect(ended.resolution).toContain('Plätze geplant');
    const view = venueView(world);
    expect(view.current).toBeNull();
    expect(view.history[0]).toMatchObject({ id: event.id, phase: 'RESULT', status: 'RESOLVED' });
    expect(endedJournal(world, 'Neon-Nacht')).toHaveLength(1);
    tickVenueEvents(world);
    expect(endedJournal(world, 'Neon-Nacht')).toHaveLength(1);
  });

  it('verschiebt ein Ergebnis nach seiner Sichtbarkeit ins Archiv', () => {
    const { world, ledger, prng } = setup();
    const event = openVenueEvent(world, 'TURNIER_ABEND')!;
    world.tick = 849;
    tickWorld(world, ledger, prng);
    expect(venueView(world).history[0]?.phase).toBe('RESULT');
    world.tick = 881;
    tickVenueEvents(world);
    expect(venueView(world).history[0]).toMatchObject({
      id: event.id, phase: 'ARCHIVED', phaseLabel: 'Archiviert', result: expect.stringContaining('Turnierabend'),
    });
  });

  it('startet keine zweite Veranstaltung, solange die vorhandene laeuft', () => {
    const { world } = setup();
    expect(openVenueEvent(world, 'NEON_NACHT')).not.toBeNull();
    expect(openVenueEvent(world, 'TURNIER_ABEND')).toBeNull();
    expect(venueView(world).current?.kind).toBe('NEON_NACHT');
    expect(world.narrative.events.filter((entry) => entry.status === 'ACTIVE')).toHaveLength(1);
  });

  it('zieht die erste Gaestewelle in jedem Startpfad nach', () => {
    const { world } = setup();
    expect(world.nextArrivalTick).toBe(10_000);
    expect(openVenueEvent(world, 'TURNIER_ABEND')).not.toBeNull();
    expect(world.nextArrivalTick).toBeLessThanOrEqual(world.tick + 1);
  });
});
