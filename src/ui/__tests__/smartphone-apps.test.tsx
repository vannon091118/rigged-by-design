/**
 * @vitest-environment jsdom
 * @test-target: src/ui/smartphone.tsx
 * @error-code: ERR-3001
 *
 * Die drei neuen Apps sind nur über das Gerät erreichbar: das Tile muss den
 * Wechsel auslösen, der Zurück-Weg zurück zur Auswahl führen und jede App ihre
 * Sicht aus dem Snapshot lesen (keine eigene Ableitung in React).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameView } from '../../store/types';
import { Smartphone } from '../smartphone';

afterEach(() => cleanup());

function view(overrides: Partial<GameView> = {}): GameView {
  return {
    day: 2,
    house: 0,
    inbox: [
      { id: 3, day: 2, tick: 90, source: 'GAST', from: 'Gast #7', subject: 'Beschwerde', body: 'Getränk warm — Laune sinkt' },
    ],
    vitter: [
      { id: 'a:RUMOR:1', author: 'Mira', about: 'Tobias', tick: 50, source: 'GERUECHT', sentiment: -1, confidence: 0.6 },
    ],
    immoluck: {
      property: { owned: null, offers: [], binding: null },
      listings: [
        { id: 'KNEIPE', label: 'Kleine Kneipe', description: 'Tresen, sechs Plätze', priceVC: 120, owned: false, affordable: false },
      ],
    },
    ...overrides,
  } as unknown as GameView;
}

describe('Smartphone-Apps', () => {
  it('öffnet Inbox, Vitter und ImmoLuck über ihre Tiles und führt zurück zur Auswahl', () => {
    render(<Smartphone view={view()} onClose={() => {}} />);

    fireEvent.click(screen.getByText('Inbox'));
    expect(document.body.textContent).toContain('Gast #7');
    expect(document.body.textContent).toContain('Getränk warm — Laune sinkt');
    fireEvent.click(screen.getAllByText('← Zurück')[0]!);

    fireEvent.click(screen.getByText('Vitter'));
    expect(document.body.textContent).toContain('Gerücht');
    expect(document.body.textContent).toContain('Sicherheit 60 %');
    fireEvent.click(screen.getAllByText('← Zurück')[0]!);

    fireEvent.click(screen.getByText('ImmoLuck'));
    expect(document.body.textContent).toContain('Kleine Kneipe');
    expect(document.body.textContent).toContain('Zu teuer');
    expect((screen.getByText('Zu teuer') as HTMLButtonElement).disabled).toBe(true);
  });

  it('benennt leere Sichten, statt eine leere Fläche zu zeigen', () => {
    render(<Smartphone view={view({ inbox: [], vitter: [] })} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Inbox'));
    expect(document.body.textContent).toContain('Noch nichts passiert');
    fireEvent.click(screen.getAllByText('← Zurück')[0]!);
    fireEvent.click(screen.getByText('Vitter'));
    expect(document.body.textContent).toContain('Niemand redet');
  });
});
