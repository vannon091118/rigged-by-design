/**
 * @vitest-environment jsdom
 * @test-target: src/ui/floor-feedback.tsx
 * @error-code: ERR-3001
 *
 * Floor-Einstiege entstehen aus dem Ort. DIALOG braucht einen konkreten
 * Dialog-/Encounter-Kontext und darf kein globaler Standardchip sein; STADT
 * bleibt der Stadt vorbehalten. Der Test deckt alle begehbaren Szenen und den
 * Wechsel zwischen ihnen ab (#770).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import { FloorFeedback } from '../floor-feedback';

afterEach(cleanup);

type SceneKind = GameView['scene']['kind'];

const EVENT = {
  id: 1,
  eventId: 'test',
  title: 'Test',
  body: '',
  step: 'OPEN',
  status: 'ACTIVE',
  expiresInTicks: 1,
  participants: [],
  choices: [],
  fallbackSlots: [],
} as const;

function view(kind: SceneKind, overrides: Partial<GameView> = {}): GameView {
  return {
    scene: { key: kind, kind, label: kind },
    queue: [],
    notice: '',
    lastEvent: '',
    narrative: { events: [], history: [], profiles: [], rivals: [] },
    player: { carrying: '' },
    ...overrides,
  } as unknown as GameView;
}

function renderFeedback(kind: SceneKind, overrides: Partial<GameView> = {}) {
  const onOpen = vi.fn();
  const rendered = render(<FloorFeedback view={view(kind, overrides)} onOpen={onOpen} />);
  return { onOpen, ...rendered };
}

describe('Floor-Einstiege folgen dem Szenenkontext', () => {
  it('zeigt DIALOG ohne konkreten Dialog-/Encounter-Kontext in keiner Szene', () => {
    for (const kind of ['OWN', 'APARTMENT', 'CITY', 'FOREIGN'] as const) {
      const { unmount } = renderFeedback(kind);
      expect(screen.queryByRole('button', { name: 'DIALOG' }), kind).toBeNull();
      unmount();
    }
  });

  it('zeigt STADT nur im Stadt-Szenenkontext', () => {
    for (const kind of ['OWN', 'APARTMENT', 'CITY', 'FOREIGN'] as const) {
      const { unmount } = renderFeedback(kind);
      const city = screen.queryByRole('button', { name: 'STADT' });
      if (kind === 'CITY') expect(city).not.toBeNull();
      else expect(city, kind).toBeNull();
      unmount();
    }
  });

  it('blendet STADT beim Szenenwechsel aus und oeffnet es in der Stadt', () => {
    const { onOpen, rerender } = renderFeedback('CITY');
    const city = screen.getByRole('button', { name: 'STADT' });
    fireEvent.click(city);
    expect(onOpen).toHaveBeenCalledWith({ kind: 'city' });

    rerender(<FloorFeedback view={view('APARTMENT')} onOpen={onOpen} />);
    expect(screen.queryByRole('button', { name: 'STADT' })).toBeNull();
  });

  it('laesst STORY an aktive Szenen gebunden und bietet daneben kein DIALOG an', () => {
    const { unmount } = renderFeedback('OWN');
    expect(screen.queryByRole('button', { name: /^STORY/ })).toBeNull();
    unmount();

    const { onOpen } = renderFeedback('OWN', {
      narrative: { events: [EVENT], history: [], profiles: [], rivals: [] },
    });
    expect(screen.queryByRole('button', { name: 'DIALOG' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^STORY/ }));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'narrative' });
  });
});
