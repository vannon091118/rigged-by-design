/**
 * @vitest-environment jsdom
 * @test-target: src/ui/dialogue-popup.tsx
 * @error-code: ERR-3001
 *
 * Die Blase zeigt Sprecher und Lauftext des aktuellen Knotens; Direktlinks
 * rufen nur die uebergebenen Menue-Handler. Gerechnet wird im Core.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DialoguePopup } from '../dialogue-popup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const noop = (): void => {};

describe('Comic-Dialog', () => {
  it('zeigt Sprecher und die erste Zeile in der Blase', () => {
    render(<DialoguePopup onClose={noop} onOpenGames={noop} onOpenStaff={noop} onOpenJournal={noop} />);

    expect(screen.getByRole('status').className).toContain('dialogue-bubble');
    expect(screen.getByRole('status').textContent).toContain('Der Abend ist noch jung');
    expect(screen.getByText('RITA', { selector: '.dialogue-speaker' }).textContent).toBe('RITA');
    expect(screen.getByText('Weiter').textContent).toBe('Weiter');
  });

  it('blaettert mit Weiter auf die naechste Zeile', () => {
    render(<DialoguePopup onClose={noop} onOpenGames={noop} onOpenStaff={noop} onOpenJournal={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(screen.getByRole('status').textContent).toContain('Wer hier arbeitet');
    expect(screen.getByRole('button', { name: 'Protokoll' }).textContent).toBe('Protokoll');
  });

  it('oeffnet aus dem Direktlink das Spielmenue', () => {
    const onOpenGames = vi.fn();
    render(<DialoguePopup onClose={noop} onOpenGames={onOpenGames} onOpenStaff={noop} onOpenJournal={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spiele' }));

    expect(onOpenGames).toHaveBeenCalledTimes(1);
  });

  it('schliesst den Dialog ueber den letzten Link', () => {
    const onClose = vi.fn();
    render(<DialoguePopup onClose={onClose} onOpenGames={noop} onOpenStaff={noop} onOpenJournal={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurueck auf den Floor' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
