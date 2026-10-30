/**
 * @vitest-environment jsdom
 * @test-target: src/ui/popup-shell.tsx
 * @error-code: ERR-3001
 *
 * UI-Integration ohne Pixi: Zustand, Fokus, Filter und Rivalenprofile.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { recordJournal } from '../../core/sim/journal';
import type { StaffAgent } from '../../core/sim/types';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { StaffStatus } from '../build-panel-parts';
import { GamesPopup } from '../games-popup';
import { Hud } from '../hud';
import { JournalPopup } from '../journal-popup';
import { LookPopup } from '../look-popup';
import { PopupShell } from '../popup-shell';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function view() {
  const world = createWorld('SMALL');
  recordJournal(world, {
    kind: 'MONEY', subject: 'Testbuchung', cause: 'EXTERNAL_WORLD → HAUSKONTO', effect: 'Gebucht.', amount: 10_000,
  });
  recordJournal(world, {
    kind: 'GUEST', subject: 'Gastentscheidung', cause: 'Durst', effect: 'Gast geht zur Bar.',
  });
  return buildView(world, new Ledger(), 'Hinweis');
}

const noop = (): void => {};

describe('UI-Integration', () => {
  it('zeigt einen Ledger-Fehler als Alarm und nicht nur als Zahl', () => {
    render(
      <Hud
        view={{ ...view(), ledgerOk: false }} onBuild={noop} onGuests={noop} onVisit={noop}
        onClean={noop} onOverview={noop} onJournal={noop} onDiagnostics={noop} onLook={noop}
        onSkill={noop}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Ledger-Prüfung fehlgeschlagen');
    expect(screen.getByRole('alert').textContent).toContain('Buchungen blockiert');
  });

  it('setzt den Fokus in den Dialog und gibt ihn nach Escape frei', () => {
    const onClose = vi.fn();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const { unmount } = render(
      <PopupShell eyebrow="TEST" title="Fokus" onClose={onClose}>
        <button type="button">Erster</button>
      </PopupShell>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Schließen'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.activeElement).toBe(outside);
  });

  it('filtert das Protokoll nach Geld und Gast', () => {
    render(<JournalPopup view={view()} onClose={noop} onGuest={noop} />);
    expect(screen.getByText('Gastentscheidung').textContent).toBe('Gastentscheidung');
    fireEvent.click(screen.getByRole('tab', { name: 'Geld' }));
    expect(screen.getByText('Testbuchung').textContent).toBe('Testbuchung');
    expect(screen.queryByText('Gastentscheidung')).toBeNull();
  });

  it('ändert den Look nur über erlaubte Optionen', () => {
    const onLook = vi.fn();
    render(<LookPopup view={view()} onClose={noop} onLook={onLook} />);
    fireEvent.click(screen.getByLabelText('Haut #e0b48c'));
    expect(onLook).toHaveBeenCalledWith({ skin: '#e0b48c' });
  });

  it('zeigt echte Rivalenprofile statt hartkodierter Häuser', () => {
    render(<GamesPopup view={view()} onClose={noop} onPlay={() => null} onTakeHome={noop} onExclusion={noop} />);
    expect(screen.getByText(/Kalle/).textContent).toContain('Kalle');
    expect(screen.queryByText('Neon-Keller')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Goldene Hand/ }));
    expect(screen.getByText(/Marlene Vest/).textContent).toContain('Marlene Vest');
  });

  it('zeigt den Personalstatus mit Auftrag und Blockadegrund', () => {
    const agent: StaffAgent = {
      id: 1, role: 'porter', x: 2, y: 2, path: [], pathIndex: 0, carryingCrate: null,
      workTicks: 0, task: 'toStorage', blockedReason: 'Lager voll',
    };
    render(<StaffStatus view={{ ...view(), agents: [agent] }} />);
    expect(screen.getByText('bringt Ersatzteile').textContent).toBe('bringt Ersatzteile');
    expect(screen.getByText('Lager voll').textContent).toBe('Lager voll');
  });
});
