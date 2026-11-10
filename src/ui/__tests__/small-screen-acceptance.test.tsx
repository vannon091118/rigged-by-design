/**
 * @vitest-environment jsdom
 * @test-target: src/App.tsx
 * @error-code: ERR-3001
 *
 * Abnahme Phase 2: die App rendert die Welt bei 320/360 px ohne Tab-Wechsel.
 * Panels und Ankerpruefung liegen in `small-screen-panels.test.tsx`, weil sie
 * am Popup-Router und an der Aktionskarte haengen, nicht an der Buehne.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import { randomSeed } from '../../test/random-seed';
import { buildView } from '../../store/snapshot';
import App from '../../App';

const harness = vi.hoisted(() => {
  const view = { current: null as GameView | null };
  const floor = { current: null as Record<string, unknown> | null };
  const noop = (): void => {};
  const worldStore = {
    talk: noop,
    spinTest: noop,
    dismiss: noop,
    spendSkill: noop,
    setLook: noop,
    pay: noop,
    serveDrink: noop,
    calm: noop,
    fightBrawl: noop,
    pickup: noop,
    deploy: noop,
    useCarriedHere: noop,
    moveTo: noop,
    moveStep: noop,
    clean: noop,
  };
  return { view, floor, worldStore };
});

vi.mock('../../render/floor-stage', async () => {
  const React = await import('react');
  return {
    FloorStage: React.forwardRef(function MockFloorStage(props: Record<string, unknown>, ref: unknown) {
      harness.floor.current = props;
      React.useImperativeHandle(ref as never, () => ({
        fit: () => {},
        zoom: () => {},
        cellAt: () => null,
        project: (worldX: number, worldY: number) => ({ x: 160, y: 320, worldX, worldY }),
        setEditor: () => {},
      }));
      return React.createElement('div', { 'data-testid': 'floor' });
    }),
  };
});

vi.mock('../../store/use-world-store', () => ({
  useWorldStore: () => harness.view.current,
  worldStore: harness.worldStore,
}));

vi.mock('../../render/music', () => ({
  armMusic: () => () => {},
  setMusicState: () => {},
}));
vi.mock('../../render/sound-fx', async () => {
  const actual = await vi.importActual<typeof import('../../render/sound-fx')>('../../render/sound-fx');
  return { ...actual, playSfx: () => {} };
});
vi.mock('../../render/haptics', () => ({ tapHaptic: () => {} }));

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

function fixture(): GameView {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  spawnGuest(world, new Prng(randomSeed()), ledger);
  return buildView(world, ledger, '');
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  harness.view.current = null;
  harness.floor.current = null;
});

// `isolate: false` teilt den Modul-Cache zwischen Testdateien. Ohne dieses
// Aufraeumen sehen spaetere Dateien die gemockte Store-Hook und den
// unvollstaendigen Sound-Mock; `ui.test.tsx` prueft aber den echten Store.
afterAll(() => {
  for (const path of [
    '../../render/floor-stage',
    '../../store/use-world-store',
    '../../render/music',
    '../../render/sound-fx',
    '../../render/haptics',
  ]) vi.doUnmock(path);
  vi.resetModules();
});

describe.each([
  [360, 640],
  [320, 640],
])('Abnahmefluss bei %i x %i', (width, height) => {
  beforeEach(() => {
    setViewport(width, height);
    harness.view.current = fixture();
    harness.floor.current = null;
  });

  it('rendert die Welt und laesst die Dock-Einstiege unbenutzt - ohne Tab-Wechsel', () => {
    render(<App />);
    expect(screen.getByTestId('floor')).not.toBeNull();

    // Die drei Dock-Einstiege existieren, wurden aber nicht geoeffnet.
    for (const label of ['BETRIEB', 'KARTE', 'DU']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull();
    }
    expect(screen.queryByText('Angebot, Personal, Preise, Lager und Wartung')).toBeNull();

    // Die Welt ist die Ansicht: kein Tab hat sie ersetzt.
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(screen.getByTestId('floor')).not.toBeNull();
  });
});
