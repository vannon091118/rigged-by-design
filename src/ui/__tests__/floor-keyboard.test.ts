/**
 * @test-target: src/ui/floor-keyboard.ts
 * @error-code: ERR-3001
 *
 * E waehlt die Hauptaktion des offenen Fokus, aber nie aus einem Eingabefeld
 * und nie bei deaktiviertem oder blockiertem Floor. Der Test ruft den reinen
 * Handler, damit kein DOM-Hook den Schluesselpfad verdeckt.
 */
import { describe, expect, it, vi } from 'vitest';
import type { MenuAction } from '../../render/floor-actions';
import type { GameView } from '../../store/types';
import { handleFloorKey, type FloorKeyboardState } from '../floor-keyboard';

const main: MenuAction = { id: 'TALK', label: 'Reden', enabled: true };

function state(over: Partial<FloorKeyboardState> = {}): FloorKeyboardState {
  return {
    view: {} as GameView,
    enabled: true,
    blocked: false,
    selection: {
      target: { kind: 'guest', id: 1 },
      actions: [main],
      anchor: null,
      status: '',
      blocked: false,
    },
    tap: vi.fn(),
    pick: vi.fn(),
    ...over,
  };
}

function key(over: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: 'e',
    repeat: false,
    target: { tagName: 'BODY' },
    preventDefault: vi.fn(),
    ...over,
  } as unknown as KeyboardEvent;
}

describe('Floor-Tastatur', () => {
  it('fuehrt die Hauptaktion des offenen Fokus aus', () => {
    const current = state();
    handleFloorKey(key(), current);
    expect(current.pick).toHaveBeenCalledWith(main);
  });

  it('ignoriert Tastendruecke bei blockiertem Floor, Wiederholung und in Eingabefeldern', () => {
    const blocked = state({ blocked: true });
    handleFloorKey(key(), blocked);
    expect(blocked.pick).not.toHaveBeenCalled();

    const repeat = state();
    handleFloorKey(key({ repeat: true }), repeat);
    expect(repeat.pick).not.toHaveBeenCalled();

    const typed = state();
    handleFloorKey(key({ target: { tagName: 'INPUT' } as unknown as EventTarget }), typed);
    expect(typed.pick).not.toHaveBeenCalled();
  });

  it('meldet eine gesperrte Hauptaktion statt sie auszufuehren', () => {
    const current = state({
      selection: {
        target: { kind: 'guest', id: 1 },
        actions: [{ id: 'FIGHT', label: 'Konfrontation', enabled: false, reason: 'Kein Streit im Gange.' }],
        anchor: null,
        status: '',
        blocked: false,
      },
    });
    handleFloorKey(key(), current);
    expect(current.pick).not.toHaveBeenCalled();
  });
});
