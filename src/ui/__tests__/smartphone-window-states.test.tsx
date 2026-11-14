/**
 * @vitest-environment jsdom
 * @test-target: src/ui/smartphone.tsx
 * @error-code: ERR-3001
 *
 * Ein Durchlauf auf derselben Geraeteflaeche: Home, App, Zurueck zur Home und
 * Schliessen. Alle acht Apps oeffnen und kehren zurueck; die Inhalte stammen
 * aus dem echten GameView-Snapshot, leere Sichten bleiben sichtbar leer.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { Smartphone } from '../smartphone';

const APP_LABELS = ['Bauen', 'Kaufen', 'Reisen', 'Putzen', 'Servieren', 'Inbox', 'Vitter', 'ImmoLuck'] as const;

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

beforeEach(() => setViewport(1280, 800));
afterEach(() => cleanup());

function realView() {
  const world = createWorld('SMALL');
  return buildView(world, new Ledger(), '');
}

describe('Smartphone-Fensterzustaende', () => {
  it('durchlaeuft Home, App, Zurueck und Schliessen auf derselben Flaeche', () => {
    setViewport(360, 640);
    const onClose = vi.fn();
    const view = realView();
    const { container } = render(<Smartphone view={view} onClose={onClose} />);

    // 1. Geraete-Home: genau eine Flaeche, acht Apps, ein Schliessen.
    expect(container.querySelectorAll('.smartphone')).toHaveLength(1);
    expect(container.querySelectorAll('.smartphone-home')).toHaveLength(1);
    expect(container.querySelectorAll('.app-tile')).toHaveLength(8);
    expect(screen.getAllByText('Schließen')).toHaveLength(1);
    expect(container.querySelector('.smartphone-status')?.textContent).toContain(`${view.day}. Tag`);

    // 2. App geoeffnet: dieselbe Flaeche, kein doppeltes Home.
    fireEvent.click(screen.getByText('Inbox'));
    expect(container.querySelectorAll('.smartphone')).toHaveLength(1);
    expect(container.querySelectorAll('.smartphone-app')).toHaveLength(1);
    expect(container.querySelectorAll('.smartphone-home')).toHaveLength(0);
    expect(screen.getAllByText('← Zurück')).toHaveLength(1);
    expect(screen.getAllByText('Schließen')).toHaveLength(2);
    // Echte Snapshot-Wahrheit: eine leere Inbox bleibt sichtbar leer.
    expect(document.body.textContent).toContain('Noch nichts passiert');

    // 3. Zurueck zur Geraete-Home, ohne die App-Flaeche zu duplizieren.
    fireEvent.click(screen.getByText('← Zurück'));
    expect(container.querySelectorAll('.smartphone')).toHaveLength(1);
    expect(container.querySelectorAll('.smartphone-home')).toHaveLength(1);
    expect(container.querySelectorAll('.smartphone-app')).toHaveLength(0);
    expect(container.querySelectorAll('.app-tile')).toHaveLength(8);

    // 4. Geraet schliessen ruft genau einmal den Elternweg, ohne Restflaeche.
    fireEvent.click(screen.getByText('Schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('oeffnet jede der acht Apps und kehrt jeweils zur selben Home zurueck', () => {
    const view = realView();
    for (const label of APP_LABELS) {
      const { container, unmount } = render(<Smartphone view={view} onClose={() => {}} />);
      fireEvent.click(screen.getByText(label));
      expect(container.querySelectorAll('.smartphone')).toHaveLength(1);
      expect(container.querySelectorAll('.smartphone-app')).toHaveLength(1);
      fireEvent.click(screen.getByText('← Zurück'));
      expect(container.querySelectorAll('.smartphone-home')).toHaveLength(1);
      expect(container.querySelectorAll('.app-tile')).toHaveLength(8);
      unmount();
    }
  });

  it('zeigt bei 320 px dieselbe Datenwahrheit ohne zweite Flaeche', () => {
    const view = realView();
    const onClose = vi.fn();

    setViewport(1280, 800);
    const normal = render(<Smartphone view={view} onClose={onClose} />);
    fireEvent.click(screen.getByText('Vitter'));
    const normalText = normal.container.textContent;
    normal.unmount();

    setViewport(320, 568);
    const small = render(<Smartphone view={view} onClose={onClose} />);
    expect(small.container.querySelectorAll('.app-tile')).toHaveLength(8);
    fireEvent.click(screen.getByText('Vitter'));
    expect(small.container.querySelectorAll('.smartphone')).toHaveLength(1);
    expect(small.container.textContent).toBe(normalText);
    expect(small.container.querySelectorAll('.smartphone-app')).toHaveLength(1);
    expect(screen.getAllByText('← Zurück')).toHaveLength(1);
    expect(screen.getAllByText('Schließen')).toHaveLength(2);

    fireEvent.click(screen.getByText('← Zurück'));
    expect(small.container.querySelectorAll('.smartphone-home')).toHaveLength(1);
    fireEvent.click(screen.getByText('Schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
