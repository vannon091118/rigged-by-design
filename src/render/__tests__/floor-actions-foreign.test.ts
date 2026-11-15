/**
 * @test-target: src/render/floor-actions.ts | @error-code: ERR-3001
 *
 * Auf einem fremden Floor nennt die Aktionskarte den Platzstatus: belegte
 * Sitze sperren den Eintrag mit Grund, freie laden ein, fremde Gaeste bleiben
 * ohne Gespraech. Die eigenen Casino-Commands sind dort unerreichbar.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createWorld } from '../../core/sim/templates';
import { visitForeignCmd } from '../../store/foreign-floor-commands';
import { buildView } from '../../store/snapshot';
import type { GameView } from '../../store/types';
import { buildActions } from '../floor-actions';

function foreignView(): GameView {
  const world = createWorld('SMALL');
  visitForeignCmd(world, 'HAFENKLAUSE');
  return buildView(world, new Ledger(), '');
}

function seatOf(view: GameView): GameView['furniture'][number] {
  const seat = view.furniture.find((item) => item.seats > 0);
  if (!seat) throw new Error('Kein Sitzmoebel auf dem fremden Floor.');
  return seat;
}

describe('Aktionskarte auf fremden Floors', () => {
  it('sperrt einen belegten Platz mit Anzahl und Grund', () => {
    const view = foreignView();
    const seat = seatOf(view);
    const occupied: GameView = {
      ...view,
      guests: Array.from({ length: seat.seats }, (_, index) => ({
        ...view.guests[0]!, id: 90_000 + index, targetFurniture: seat.id,
      })),
    };

    const [action] = buildActions(occupied, { kind: 'furniture', id: seat.id });

    expect(action?.id).toBe('FOREIGN_SIT');
    expect(action?.enabled).toBe(false);
    expect(action?.reason).toMatch(/Platz belegt \(\d+\/\d+\)/);
  });

  it('laesst einen freien Platz zu', () => {
    const view = foreignView();
    const seat = seatOf(view);

    const [action] = buildActions({ ...view, guests: [] }, { kind: 'furniture', id: seat.id });

    expect(action?.id).toBe('FOREIGN_SIT');
    expect(action?.enabled).toBe(true);
    expect(action?.reason).toBeUndefined();
  });

  it('bedient fremde Moebel nicht mit eigenen Commands', () => {
    const view = foreignView();
    const fixture = view.furniture.find((item) => item.seats === 0)!;

    const [action] = buildActions(view, { kind: 'furniture', id: fixture.id });

    expect(action?.id).toBe('FOREIGN_LOOK');
    expect(action?.enabled).toBe(false);
    expect(action?.reason).toMatch(/fremden Haus/);
  });

  it('meldet beim Ansprechen eines fremden Gastes den klaren Zustand', () => {
    const view = foreignView();
    const guest = view.guests[0]!;

    const [action] = buildActions(view, { kind: 'guest', id: guest.id });

    expect(action?.id).toBe('FOREIGN_TALK');
    expect(action?.enabled).toBe(false);
    expect(action?.reason).toMatch(/Gespräch/);
  });
});
