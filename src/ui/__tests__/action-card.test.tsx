/**
 * @vitest-environment jsdom
 * @test-target: src/ui/action-card.tsx
 * @error-code: ERR-3001
 *
 * Regression #767: Der Gast-Builder liefert fünf Aktionen. Die kompakte Karte
 * darf höchstens zwei Alternativen direkt zeigen, muss die übrigen aber über
 * einen sichtbaren Einstieg erreichbar halten statt sie still abzuschneiden.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { CITY_STREET_DOOR_IDS } from '../../core/sim/city-doors';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { buildView } from '../../store/snapshot';
import { SceneCommands } from '../../store/scene-commands';
import { buildDoorActions, type MenuAction } from '../../render/floor-actions';
import { doorTap, handleTap } from '../../render/floor-input';
import { ActionCard } from '../action-card';
import { CityDoorAccess, CityDoorAccessLayer, cityDoorAccessEntries } from '../city-door-access';

afterEach(cleanup);

const guestActions: readonly MenuAction[] = [
  { id: 'TALK', label: 'Reden', enabled: true, targetId: 7, target: { kind: 'guest', id: 7 } },
  { id: 'CALM', label: 'Schlichten', enabled: true, targetId: 7, target: { kind: 'guest', id: 7 } },
  { id: 'FIGHT', label: 'Konfrontation', enabled: true, targetId: 7, target: { kind: 'guest', id: 7 } },
  { id: 'SERVE_DRINK', label: 'Drink servieren', enabled: true, targetId: 7, target: { kind: 'guest', id: 7 } },
  { id: 'OPEN_GUEST', label: 'Profil', enabled: true, targetId: 7, target: { kind: 'guest', id: 7 } },
];

describe('ActionCard mit fünf Gastaktionen', () => {
  it('macht die abgeschnittenen Aktionen über Weitere Aktionen erreichbar', () => {
    const onPick = vi.fn();
    render(<ActionCard actions={guestActions} onPick={onPick} onClose={() => {}} />);

    for (const label of ['Reden', 'Schlichten', 'Konfrontation']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull();
    }

    const more = screen.getByRole('button', { name: 'Weitere Aktionen (2)' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');

    for (const action of guestActions) {
      fireEvent.click(screen.getByRole('button', { name: action.label }));
    }

    expect(onPick.mock.calls.map(([action]) => action.id)).toEqual(
      guestActions.map((action) => action.id),
    );
  });
});

function city() {
  const world = createWorld('SMALL');
  const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
  scene.enterCity();
  return buildView(world, new Ledger(), '');
}

const pixels = (view: ReturnType<typeof city>, id: string) => {
  const edge = view.layout.edges.find((entry) => entry.kind === 'DOOR' && entry.id === id);
  if (!edge) throw new Error(`Tür ${id} fehlt`);
  return { x: (edge.x + 0.5) * TILE, y: (edge.y + 0.5) * TILE };
};

describe('Stadttüren als DOM-Ortsziele', () => {
  it('listet jede erreichbare Tür in der Reihenfolge des Renderplans', () => {
    const view = city();
    render(<CityDoorAccess view={view} onActivate={() => undefined} />);

    const nav = screen.getByRole('navigation', { name: 'Türen und Ortsziele' });
    const buttons = screen.getAllByRole('button');
    const labels = buttons.map((button) => button.getAttribute('aria-label'));

    expect(nav.getAttribute('aria-label')).toBe('Türen und Ortsziele');
    expect(labels).toEqual(
      CITY_STREET_DOOR_IDS.map((id) => buildDoorActions(view, id)[0]?.label),
    );
    expect(cityDoorAccessEntries(view).map((entry) => entry.id)).toEqual([...CITY_STREET_DOOR_IDS]);
  });

  it('nutzt bei Enter, Space und Klick denselben Tür-Command', () => {
    const view = city();
    const onActivate = vi.fn();
    render(<CityDoorAccess view={view} onActivate={onActivate} />);

    const button = screen.getByRole('button', { name: 'Wohnung betreten' });
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.click(button);

    expect(onActivate.mock.calls.map(([id]) => id)).toEqual([
      'door_street_to_player_apt',
      'door_street_to_player_apt',
      'door_street_to_player_apt',
    ]);
  });

  it('nennt den Sperrgrund ohne Hover und hält das Ziel fokussierbar', () => {
    const view = city();
    const shop = 'door_street_to_corner_shop';
    render(<CityDoorAccess view={view} onActivate={() => undefined} />);

    const button = screen.getByRole('button', { name: 'Laden betreten' });
    const reasonId = button.getAttribute('aria-describedby');
    const reason = reasonId ? document.getElementById(reasonId) : null;

    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(reason?.textContent).toContain('Markt');
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(buildDoorActions(view, shop)[0]?.reason).toContain('Markt');
  });

  it('zeigt die Liste nur im Operator-Stadtzustand und leitet den Klick durch den Pixi-Tap', () => {
    const view = city();
    const tap = vi.fn();
    const props = {
      view,
      interaction: { tap },
      perspective: 'operator' as const,
      popup: null,
      buildOpen: false,
      editorOpen: false,
    };
    const { rerender } = render(<CityDoorAccessLayer {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Wohnung betreten' }));
    expect(tap).toHaveBeenCalledWith(doorTap(view, 'door_street_to_player_apt'));

    rerender(<CityDoorAccessLayer {...props} popup={{ kind: 'city' }} />);
    expect(screen.queryByRole('navigation', { name: 'Türen und Ortsziele' })).toBeNull();

    rerender(<CityDoorAccessLayer {...props} perspective="guest" />);
    expect(screen.queryByRole('navigation', { name: 'Türen und Ortsziele' })).toBeNull();
  });

  it('liefert für jede Tür dieselbe Aktion wie der Pixi-Tap', () => {
    const view = city();
    const cues = () => ({ ping: () => undefined });

    for (const id of CITY_STREET_DOOR_IDS) {
      const viaAccess = doorTap(view, id);
      const viaPixel = handleTap(0, pixels(view, id), view, cues());
      expect(viaAccess?.target).toEqual({ kind: 'door', id });
      expect(viaAccess?.actions).toEqual(viaPixel?.actions);
    }
  });
});
