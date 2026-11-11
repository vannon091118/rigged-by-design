/**
 * @vitest-environment jsdom
 * @test-target: src/ui/venue-history.tsx
 * @error-code: ERR-3001
 *
 * Die Historie der Veranstaltung ist ein Leser der vorhandenen Event-Instanz:
 * nach der Auflösung steht das Ergebnis im Charakterfenster statt "kein Turnierabend".
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorld } from '../../core/sim/templates';
import { openVenueEvent, tickVenueEvents, venueView } from '../../core/sim/venue-event';
import { VenueHistory } from '../venue-history';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('Veranstaltungs-Historie', () => {
  it('zeigt nach der Auflösung das Ergebnis der Veranstaltung', () => {
    const world = createWorld('SMALL');
    world.tick = 700;
    world.nextArrivalTick = 10_000;
    expect(openVenueEvent(world, 'TURNIER_ABEND')).not.toBeNull();
    world.tick = 850;
    tickVenueEvents(world);

    render(<VenueHistory venue={venueView(world)} />);

    expect(screen.getByText('VERANSTALTUNGEN')).toBeTruthy();
    expect(screen.getByText('Turnierabend')).toBeTruthy();
    expect(screen.getByText('Ergebnis')).toBeTruthy();
    expect(screen.getByText(/Gäste im Haus/)).toBeTruthy();
  });

  it('bleibt ohne Historie unsichtbar', () => {
    const world = createWorld('SMALL');
    world.tick = 700;
    const { container } = render(<VenueHistory venue={venueView(world)} />);
    expect(container.innerHTML).toBe('');
  });
});
