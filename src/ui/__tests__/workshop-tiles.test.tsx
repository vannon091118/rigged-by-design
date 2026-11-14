/**
 * @vitest-environment jsdom
 * @test-target: src/ui/workshop.tsx
 * @error-code: ERR-3001
 *
 * Sechs Kacheln, sechs vorhandene Panels: jede Kachel oeffnet genau ihren
 * Zustand, Zurueck fuehrt ins Raster, Schliessen in die laufende Sitzung.
 * Geraet und Hilfe sind Zusatzflaechen und keine Rasterziele.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { worldStore } from '../../store/use-world-store';
import { WorkshopPopup } from '../workshop';

const noop = (): void => {};

beforeEach(() => { worldStore.newGame('SMALL'); });
afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

function renderWorkshop(onClose: () => void = noop) {
  render(<WorkshopPopup view={worldStore.getSnapshot()} onClose={onClose} onGuest={noop} />);
}

function tileCount(): number {
  return document.querySelectorAll('.workshop-tile').length;
}

function backToGrid(): void {
  fireEvent.click(screen.getByRole('button', { name: /ZURÜCK ZUM RASTER/ }));
  expect(tileCount()).toBe(6);
}

describe('Werkstatt-Kacheln', () => {
  it('oeffnet fuer jede der sechs Kacheln ihr vorhandenes Panel und kehrt zurueck', () => {
    renderWorkshop();
    expect(tileCount()).toBe(6);

    fireEvent.click(screen.getByRole('button', { name: /Prüfung/ }));
    expect(screen.getByText('Buchhaltung')).not.toBeNull();
    expect(screen.getAllByText('Personal').length).toBeGreaterThan(0);
    backToGrid();

    fireEvent.click(screen.getByRole('button', { name: /Protokoll/ }));
    expect(screen.getByText('Suche')).not.toBeNull();
    backToGrid();

    fireEvent.click(screen.getByRole('button', { name: /Assets/ }));
    expect(screen.getByText('Animationen')).not.toBeNull();
    expect(screen.getByText('Emitter')).not.toBeNull();
    backToGrid();

    fireEvent.click(screen.getByRole('button', { name: /Sound/ }));
    expect(screen.getByText('Gesamt')).not.toBeNull();
    expect(screen.getByText('Musik')).not.toBeNull();
    backToGrid();

    fireEvent.click(screen.getByRole('button', { name: /Steuerung/ }));
    expect(screen.getByText(/Die Steuerung gilt auf dem Floor/)).not.toBeNull();
    backToGrid();

    fireEvent.click(screen.getByRole('button', { name: /FPS/ }));
    expect(screen.getByText('60 fps')).not.toBeNull();
    expect(screen.getByText('Frame')).not.toBeNull();
    backToGrid();
  });

  it('fuehrt Geraet und Hilfe als getrennte Flaechen, nicht als Rasterziele', () => {
    const close = vi.fn();
    renderWorkshop(close);

    expect(tileCount()).toBe(6);
    expect(screen.queryByRole('button', { name: /^GERÄT$/ })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'GERÄT' }));
    expect(screen.getByText('Smartphone')).not.toBeNull();
    expect(tileCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(close).toHaveBeenCalledTimes(1);

    cleanup();
    renderWorkshop(close);
    fireEvent.click(screen.getByRole('button', { name: 'HILFE' }));
    expect(screen.getByText('So funktioniert dein Haus')).not.toBeNull();
    expect(tileCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('schliesst aus dem Raster in die laufende Sitzung, ohne Zustand zu ersetzen', () => {
    const close = vi.fn();
    const scene = worldStore.getSnapshot().scene;
    renderWorkshop(close);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(worldStore.getSnapshot().scene).toEqual(scene);
  });
});
