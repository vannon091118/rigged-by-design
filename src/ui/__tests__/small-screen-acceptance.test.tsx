/**
 * @vitest-environment jsdom
 * @test-target: src/App.tsx
 * @error-code: ERR-3001
 *
 * Abnahme Phase 2: NPC waehlen, handeln, Geraet bedienen und mit Escape zurueck
 * auf den Floor - ohne Tab-Wechsel. Die Buehne ist gemockt (kein Pixi/WebGL),
 * Store und Popup-Routing laufen ueber die echten App-Callbacks. Zusaetzlich
 * wird die Aktionskarte bei 320/360 px an beiden Viewport-Raendern geklemmt.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import { randomSeed } from '../../test/random-seed';
import { buildView } from '../../store/snapshot';
import App from '../../App';
import { Dock } from '../dock';
import { Hud } from '../hud';

const harness = vi.hoisted(() => {
  const calls = {
    talk: [] as number[],
    spinTest: [] as number[],
  };
  const view = { current: null as GameView | null };
  const floor = { current: null as Record<string, unknown> | null };
  const project = { x: 160, y: 320 };
  const noop = (): void => {};
  const worldStore = {
    talk: (id: number) => { calls.talk.push(id); },
    spinTest: (id: number) => { calls.spinTest.push(id); },
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
  return { calls, view, floor, project, worldStore };
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
        project: (worldX: number, worldY: number) => ({
          x: harness.project.x,
          y: harness.project.y,
          worldX,
          worldY,
        }),
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

const noop = (): void => {};

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

function fixture() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  const machine = world.furniture.find((entry) => Boolean(entry.gameId))!;
  return { view: buildView(world, ledger, ''), guest, machine };
}

function fireFloor(name: string, ...args: unknown[]): void {
  const handler = harness.floor.current?.[name];
  if (typeof handler !== 'function') throw new Error(`FloorStage ohne ${name}`);
  act(() => { (handler as (...values: unknown[]) => void)(...args); });
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
    harness.project.x = width / 2;
    harness.project.y = 320;
    harness.calls.talk.length = 0;
    harness.calls.spinTest.length = 0;
    harness.floor.current = null;
  });

  it('NPC waehlen, handeln, Geraet bedienen und per Escape zurueck - ohne Tab-Wechsel', async () => {
    const { view, guest, machine } = fixture();
    harness.view.current = view;
    render(<App />);
    expect(screen.getByTestId('floor')).not.toBeNull();

    // Aktionskarte klemmt oben und unten im Viewport statt aus ihm herauszulaufen.
    harness.project.y = 60;
    fireFloor('onActions', [{ id: 'TALK', label: 'Reden', enabled: true }], {
      x: width / 2, y: 60, worldX: 4, worldY: 4,
    });
    let card = screen.getByRole('group', { name: 'Aktionen' });
    const topAbove = Number.parseFloat(card.style.getPropertyValue('--anchor-top'));
    const cardWidth = Math.min(340, width - 16);
    const cardLeft = Math.max(8, Math.min(width / 2 - cardWidth / 2, width - 8 - cardWidth));
    expect(Number.parseFloat(card.style.getPropertyValue('--anchor-left'))).toBe(cardLeft);
    expect(Number.parseFloat(card.style.getPropertyValue('--anchor-width'))).toBe(cardWidth);
    expect(cardLeft + cardWidth).toBeLessThanOrEqual(width - 8);
    expect(topAbove).toBeGreaterThanOrEqual(8);
    expect(topAbove + 118).toBeLessThanOrEqual(height - 8);

    harness.project.y = height - 30;
    fireFloor('onActions', [{ id: 'TALK', label: 'Reden', enabled: true }], {
      x: width / 2, y: height - 30, worldX: 4, worldY: 4,
    });
    card = screen.getByRole('group', { name: 'Aktionen' });
    const topBelow = Number.parseFloat(card.style.getPropertyValue('--anchor-top'));
    expect(topBelow).toBeGreaterThan(topAbove);
    expect(topBelow + 118).toBeLessThanOrEqual(height - 8);
    fireEvent.click(within(card).getByRole('button', { name: 'Schliessen' }));
    expect(screen.queryByRole('group', { name: 'Aktionen' })).toBeNull();

    // NPC: Objektpanel oeffnen, eine Handlung ausfuehren, per Escape zurueck.
    fireFloor('onGuest', guest.id, { x: width / 2, y: 320, worldX: 6, worldY: 7 });
    const guestDialog = screen.getByRole('dialog', { name: guest.name });
    expect(guestDialog.getAttribute('data-surface')).toBe('object');
    fireEvent.click(within(guestDialog).getByRole('button', { name: /REDEN/ }));
    expect(harness.calls.talk).toEqual([guest.id]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('floor')).not.toBeNull();

    // Geraet: Diagnose oeffnen, Testspin ausloesen, per Escape zurueck.
    fireFloor('onFurniture', machine.id, { x: width / 2, y: 320, worldX: 8, worldY: 9 });
    const machineDialog = screen.getByRole('dialog', { name: machine.label });
    expect(machineDialog.getAttribute('data-surface')).toBe('object');
    fireEvent.click(within(machineDialog).getByRole('button', { name: 'TESTSPIN' }));
    await waitFor(() => expect(harness.calls.spinTest).toEqual([machine.id]), { timeout: 1500 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('floor')).not.toBeNull();

    // Kein Tab-Wechsel: Die drei Dock-Einstiege existieren, wurden aber nicht benutzt.
    for (const label of ['BETRIEB', 'KARTE', 'DU']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull();
    }
    expect(screen.queryByText('Angebot, Personal, Preise, Lager und Wartung')).toBeNull();
  });

  it('haelt alle Dock-Einstiege und die Gaesteuebersicht bei %i px bedienbar', () => {
    const { view } = fixture();
    harness.view.current = view;
    const onPlay = vi.fn();
    const onBuild = vi.fn();
    const onOpen = vi.fn();
    render(
      <Dock
        view={view}
        perspective="operator"
        onPlay={onPlay}
        onBuild={onBuild}
        onClean={noop}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'BETRIEB' }));
    fireEvent.click(screen.getByRole('button', { name: 'KARTE' }));
    fireEvent.click(screen.getByRole('button', { name: 'DU' }));
    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenNthCalledWith(1, { kind: 'foreignMap' });
    expect(onOpen).toHaveBeenNthCalledWith(2, { kind: 'workshop' });
    expect(onPlay).not.toHaveBeenCalled();

    cleanup();
    const onGuests = vi.fn();
    render(
      <Hud
        view={view}
        perspective="operator"
        onPerspective={noop}
        onSkill={noop}
        onGuests={onGuests}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gästeübersicht öffnen' }));
    expect(onGuests).toHaveBeenCalledTimes(1);
  });
});
