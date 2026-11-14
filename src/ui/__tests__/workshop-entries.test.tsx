/**
 * @vitest-environment jsdom
 * @test-target: src/ui/workshop.tsx
 * @error-code: ERR-3001
 *
 * Beide Werkstatt-Einstiege oeffnen dieselbe Oberflaeche ueber der laufenden
 * Szene: fuenf Tipps auf die Marke und Strg+Shift+D. Kein zweites Overlay,
 * kein Zustandsverlust beim Schliessen.
 */
import { useState } from 'react';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { worldStore } from '../../store/use-world-store';
import type { Popup } from '../app-model';
import { useWorkshopShortcut } from '../app-effects';
import { ConnectedHud } from '../connected-hud';
import { useBrandTaps } from '../dock';
import { PopupRouter } from '../popup-router';

const noop = (): void => {};

beforeEach(() => { worldStore.newGame('SMALL'); });
afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

function backdropCount(): number {
  return document.querySelectorAll('.popup-backdrop').length;
}

function WorkshopHarness() {
  const view = worldStore.getSnapshot();
  const [popup, setPopup] = useState<Popup>(null);
  useWorkshopShortcut(() => setPopup({ kind: 'workshop' }));
  return (
    <>
      <ConnectedHud view={view} perspective="operator" onPerspective={noop} onOpen={setPopup} />
      <PopupRouter
        view={view}
        perspective="operator"
        popup={popup}
        onClose={() => setPopup(null)}
        onOpen={setPopup}
        onStaff={noop}
      />
    </>
  );
}

describe('Werkstatt-Einstiege', () => {
  it('oeffnet nach fuenf Marken-Tipps genau ein Overlay und schliesst in dieselbe Szene', () => {
    const sceneBefore = worldStore.getSnapshot().scene;
    render(<WorkshopHarness />);
    const brand = document.querySelector('.hud-brand');
    if (!brand) throw new Error('Marke fehlt im HUD.');

    for (let tap = 0; tap < 4; tap += 1) fireEvent.click(brand);
    expect(backdropCount()).toBe(0);

    fireEvent.click(brand);
    expect(backdropCount()).toBe(1);
    expect(screen.getByText('Werkstatt')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(backdropCount()).toBe(0);
    expect(worldStore.getSnapshot().scene).toEqual(sceneBefore);
  });

  it('oeffnet per Tastenkürzel dieselbe Werkstatt wie per Marke', () => {
    render(<WorkshopHarness />);
    const brand = document.querySelector('.hud-brand');
    if (!brand) throw new Error('Marke fehlt im HUD.');

    for (let tap = 0; tap < 5; tap += 1) fireEvent.click(brand);
    const brandTiles = [...document.querySelectorAll('.workshop-tile')].map((tile) => tile.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(backdropCount()).toBe(0);

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, shiftKey: true });
    expect(backdropCount()).toBe(1);
    expect(screen.getByText('Werkstatt')).not.toBeNull();
    const shortcutTiles = [...document.querySelectorAll('.workshop-tile')].map((tile) => tile.textContent);

    expect(shortcutTiles).toEqual(brandTiles);
    expect(shortcutTiles).toHaveLength(6);
  });

  it('zaehlt Marken-Tipps nur im Zeitfenster und ignoriert Tasten-Wiederholung', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useBrandTaps(open));
    result.current(1_000);
    result.current(1_100);
    result.current(1_200);
    result.current(1_300);
    expect(open).not.toHaveBeenCalled();
    result.current(1_400);
    expect(open).toHaveBeenCalledTimes(1);

    // Nach dem Fenster beginnt die Zaehlung von vorn; vier Tipps reichen nicht.
    result.current(3_000);
    result.current(3_100);
    result.current(3_200);
    result.current(3_300);
    expect(open).toHaveBeenCalledTimes(1);

    const shortcutOpen = vi.fn();
    renderHook(() => useWorkshopShortcut(shortcutOpen));
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, shiftKey: true, repeat: true });
    expect(shortcutOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true, shiftKey: true });
    expect(shortcutOpen).toHaveBeenCalledTimes(1);
  });
});
