/**
 * @vitest-environment jsdom
 * @test-target: src/ui/dock.tsx
 * @error-code: ERR-3001
 *
 * Abnahme Phase 2: alle Dock-Einstiege und die Gaesteuebersicht bleiben bei
 * 320/360 px bedienbar. Die Komponenten sind prop-getrieben, deshalb braucht
 * diese Datei weder Buehnen- noch Store-Mock.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import { randomSeed } from '../../test/random-seed';
import { buildView } from '../../store/snapshot';
import { Dock } from '../dock';
import { Hud } from '../hud';

const noop = (): void => {};

function fixture() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  spawnGuest(world, new Prng(randomSeed()), ledger);
  return buildView(world, ledger, '');
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe.each([
  [360, 640],
  [320, 640],
])('Dock bei %i x %i', (width, height) => {
  it('haelt alle Dock-Einstiege und die Gaesteuebersicht bei %i px bedienbar', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
    window.dispatchEvent(new Event('resize'));

    const view = fixture();
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
