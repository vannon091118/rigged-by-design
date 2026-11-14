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
import type { MenuAction } from '../../render/floor-actions';
import { ActionCard } from '../action-card';

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
