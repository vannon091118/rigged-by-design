/**
 * @vitest-environment jsdom
 * @test-target: src/ui/popup-router.tsx
 * @error-code: ERR-3001
 *
 * Abnahme Phase 2 auf kleinen Displays: Die Aktionskarte klemmt an beiden
 * Viewport-Raendern, NPC und Geraet oeffnen ein Objektpanel, Escape gibt den
 * Floor frei. Kein Pixi: Panels haengen am Snapshot, nicht an der Buehne.
 */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import type { MenuAction } from '../../render/floor-actions';
import { randomSeed } from '../../test/random-seed';
import { buildView } from '../../store/snapshot';
import { worldStore } from '../../store/use-world-store';
import { ActionCard } from '../action-card';
import type { Popup } from '../app-model';
import { PopupRouter } from '../popup-router';

const harness = vi.hoisted(() => ({ calls: { talk: [] as number[], spinTest: [] as number[] } }));

beforeEach(() => {
  // Echte Methoden mit aufgezeichneten Aufrufen: kein Modul-Mock, der bei
  // isolate:false in spaetere UI-Dateien leckt.
  vi.spyOn(worldStore, 'talk').mockImplementation((id: number) => { harness.calls.talk.push(id); });
  vi.spyOn(worldStore, 'spinTest').mockImplementation((id: number) => { harness.calls.spinTest.push(id); return null; });
});

function fixture() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  const machine = world.furniture.find((entry) => Boolean(entry.gameId))!;
  return { view: buildView(world, ledger, ''), guest, machine };
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

/** Ein Panel-Harness: der Router oeffnet und schliesst wie in App. */
function RouterHarness({ view, initial }: { readonly view: GameView; readonly initial: Popup }) {
  const [popup, setPopup] = useState<Popup>(initial);
  return (
    <PopupRouter
      view={view}
      perspective="operator"
      popup={popup}
      onClose={() => setPopup(null)}
      onOpen={setPopup}
      onStaff={() => {}}
    />
  );
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  harness.calls.talk.length = 0;
  harness.calls.spinTest.length = 0;
});

describe.each([
  [360, 640],
  [320, 640],
])('kleine Displays bei %i x %i', (width, height) => {
  it('klemmt die Aktionskarte an beiden Raendern im Viewport', () => {
    setViewport(width, height);
    const onClose = vi.fn();
    const actions: readonly MenuAction[] = [
      { id: 'TALK', label: 'Reden', enabled: true },
    ] as unknown as readonly MenuAction[];
    const { rerender } = render(
      <ActionCard
        actions={actions}
        anchor={{ x: width / 2, y: 60, worldX: 4, worldY: 4 }}
        onPick={() => {}}
        onClose={onClose}
      />,
    );

    let card = screen.getByRole('group', { name: 'Aktionen' });
    const topAbove = Number.parseFloat(card.style.getPropertyValue('--anchor-top'));
    const cardWidth = Math.min(340, width - 16);
    const cardLeft = Math.max(8, Math.min(width / 2 - cardWidth / 2, width - 8 - cardWidth));
    expect(Number.parseFloat(card.style.getPropertyValue('--anchor-left'))).toBe(cardLeft);
    expect(Number.parseFloat(card.style.getPropertyValue('--anchor-width'))).toBe(cardWidth);
    expect(cardLeft + cardWidth).toBeLessThanOrEqual(width - 8);
    expect(topAbove).toBeGreaterThanOrEqual(8);
    expect(topAbove + 118).toBeLessThanOrEqual(height - 8);

    rerender(
      <ActionCard
        actions={actions}
        anchor={{ x: width / 2, y: height - 30, worldX: 4, worldY: 4 }}
        onPick={() => {}}
        onClose={onClose}
      />,
    );
    card = screen.getByRole('group', { name: 'Aktionen' });
    const topBelow = Number.parseFloat(card.style.getPropertyValue('--anchor-top'));
    expect(topBelow).toBeGreaterThan(topAbove);
    expect(topBelow + 118).toBeLessThanOrEqual(height - 8);

    fireEvent.click(within(card).getByRole('button', { name: 'Schliessen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('oeffnet NPC und Geraet als Objektpanel und gibt per Escape den Floor frei', async () => {
    setViewport(width, height);
    const { view, guest, machine } = fixture();

    render(<RouterHarness view={view} initial={{ kind: 'guests', guestId: guest.id }} />);
    const guestDialog = screen.getByRole('dialog', { name: guest.name });
    expect(guestDialog.getAttribute('data-surface')).toBe('object');
    fireEvent.click(within(guestDialog).getByRole('button', { name: /REDEN/ }));
    expect(harness.calls.talk).toEqual([guest.id]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    cleanup();
    render(<RouterHarness view={view} initial={{ kind: 'machine', itemId: machine.id }} />);
    const machineDialog = screen.getByRole('dialog', { name: machine.label });
    expect(machineDialog.getAttribute('data-surface')).toBe('object');
    fireEvent.click(within(machineDialog).getByRole('button', { name: 'TESTSPIN' }));
    await waitFor(() => expect(harness.calls.spinTest).toEqual([machine.id]), { timeout: 1500 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
