/**
 * @vitest-environment jsdom
 * @test-target: src/ui/narrative-popup.tsx
 * @error-code: ERR-3001
 *
 * Die UI zeigt nur, was der Snapshot liefert: Szenentext, Frist, gesperrte
 * Choices mit Grund und Profile. Gerechnet wird im Core.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { emitFact } from '../../core/sim/narrative/facts';
import { processNarrativeRuntime } from '../../core/sim/narrative/runtime';
import { createWorld } from '../../core/sim/templates';
import { recordVisitor } from '../../core/sim/visitors';
import { buildView } from '../../store/snapshot';
import { NarrativePopup } from '../narrative-popup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const noop = (): void => {};

function scene() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const visitor = recordVisitor(world, { name: 'Rita Kern', persona: 'STAMMGAST', tick: 0 });
  emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
  processNarrativeRuntime(world, ledger);
  const event = world.narrative.events[0]!;
  return { view: buildView(world, ledger, ''), eventId: event.id };
}

describe('Narrative UI (NAR-14)', () => {
  it('zeigt Szene, Frist und genau eine verfügbare Choice', () => {
    const { view, eventId } = scene();
    const onChoose = vi.fn();

    render(<NarrativePopup view={view} onClose={noop} onChoose={onChoose} onDismiss={noop} />);

    expect(screen.getByRole('article').className).toContain('narrative-card');
    expect(screen.getByTitle('Verbleibende Zeit bis die Szene verfaellt').textContent).toMatch(/^\d+ (s|min)$/);
    fireEvent.click(screen.getByRole('button', { name: 'Ihn mit einem Nicken an den Tresen holen.' }));

    expect(onChoose).toHaveBeenCalledWith(eventId, 'WELCOME_BACK');
  });

  it('zeigt keinen Sicherheitscopy-Hinweis, wenn alle Slots einen Text haben', () => {
    const { view } = scene();

    render(<NarrativePopup view={view} onClose={noop} onChoose={noop} onDismiss={noop} />);

    expect(screen.queryByText(/Ohne passenden Text/)).toBeNull();
  });

  it('lässt eine gesperrte Choice nicht klicken und nennt den Grund', () => {
    const { view } = scene();
    const onChoose = vi.fn();

    render(<NarrativePopup view={view} onClose={noop} onChoose={onChoose} onDismiss={noop} />);

    const blocked = screen.getByRole('button', { name: 'Nach seinem letzten Abend fragen.' }) as HTMLButtonElement;

    expect(blocked.disabled).toBe(true);
    expect(screen.getByText(/Voraussetzung fehlt/).textContent).toContain('Voraussetzung fehlt');
    fireEvent.click(blocked);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('schliesst eine Szene nur über den Command-Pfad', () => {
    const { view, eventId } = scene();
    const onDismiss = vi.fn();

    render(<NarrativePopup view={view} onClose={noop} onChoose={noop} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'SPÄTER' }));

    expect(onDismiss).toHaveBeenCalledWith(eventId);
  });

  it('oeffnet aus einem Gast-Popup direkt das angeforderte Profil', () => {
    const { view } = scene();
    const visitorId = view.narrative.profiles[0]!.visitorId;

    render(<NarrativePopup view={view} initialVisitorId={visitorId} onClose={noop} onChoose={noop} onDismiss={noop} />);

    expect(screen.getByRole('tab', { name: /FIGUREN/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('article', { name: 'Profil Rita Kern' }).textContent).toContain('Rita Kern');
  });

  it('zeigt fuer eine unbekannte Figur kein fremdes Profil', () => {
    const { view } = scene();

    render(<NarrativePopup view={view} initialVisitorId={999} onClose={noop} onChoose={noop} onDismiss={noop} />);

    expect(screen.getByText('Zu dieser Figur liegt noch kein Profil vor.').textContent).toContain('kein Profil');
    expect(screen.queryByRole('article', { name: 'Profil Rita Kern' })).toBeNull();
  });

  it('zeigt im Figuren-Tab das Profil mit Besuchen und offener Geschichte', () => {
    const { view } = scene();

    render(<NarrativePopup view={view} onClose={noop} onChoose={noop} onDismiss={noop} />);
    fireEvent.click(screen.getByRole('tab', { name: /FIGUREN/ }));

    const profile = screen.getByRole('article', { name: 'Profil Rita Kern' });
    expect(profile.textContent).toContain('Rita Kern');
    expect(profile.textContent).toContain('1 Besuch');
    expect(profile.textContent).toContain('VISITOR_RETURN');
    expect(profile.textContent).toContain('Noch keine Erinnerung');
  });
});
