/**
 * @vitest-environment jsdom
 * @test-target: src/ui/look-popup.tsx
 * @error-code: ERR-3001
 *
 * Das Charakterfenster zeigt Werte aus der Karriere-Sicht, nicht aus einem zweiten Zustand.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import type { PropertyId } from '../../core/sim/types';
import { EXTERNAL, PORTEMONNAIE } from '../../core/sim/money';
import { recordJournal } from '../../core/sim/journal';
import { grantXp } from '../../core/sim/player-rpg';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { LookPopup } from '../look-popup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

interface Options {
  readonly onChallenge?: () => void;
  readonly onBuyProperty?: (id: PropertyId) => void;
  readonly backyard?: boolean;
  readonly injured?: boolean;
  readonly emptyHistory?: boolean;
  readonly walletVC?: number;
  readonly ownedProperty?: boolean;
}

function renderPopup(options: Options = {}) {
  const world = createWorld('SMALL');
  grantXp(world.player.rpg, 450);
  world.player.barPurchased = true;
  if (options.ownedProperty) world.player.property = { id: 'KNEIPE', priceVC: fromVC(120), day: 3 };
  if (options.injured) world.player.rpg.injuryTicks = 20;
  if (!options.emptyHistory) {
    recordJournal(world, {
      kind: 'GUEST', subject: 'Duell gegen Rocco', cause: 'Rädelsführer fordert dich',
      effect: 'Gewonnen: der Rädelsführer ist raus.', refs: {},
    });
  }
  if (options.backyard) {
    recordJournal(world, {
      kind: 'SYSTEM', subject: 'Hinterhof gegen Bulle Bernd', cause: 'Hinterhof-Schläger · Rang 1/6',
      effect: 'Gewonnen: KO in Runde 2 · Preisgeld 1,20 VC.',
    });
  }
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(options.walletVC ?? 10), 'test startgeld', 0);
  const view = buildView(world, ledger, 'Hinweis');
  render(<LookPopup view={view} onClose={() => {}} onLook={() => {}} onChallenge={options.onChallenge} onBuyProperty={options.onBuyProperty} />);
  return view;
}

describe('Charakterfenster: Werte', () => {
  it('zeigt Level, XP-Ziel und Koerper aus derselben Sicht wie der Zustand', () => {
    const view = renderPopup();
    expect(screen.getByText(`LEVEL ${view.career.level}`).textContent).toBe(`LEVEL ${view.career.level}`);
    expect(screen.getByText(`${view.career.xp} / ${view.career.xp + view.career.xpToNext} XP`).tagName).toBe('SPAN');
    expect(screen.getByText(/LP · kampfbereit/).className).toContain('career-hp');
  });

  it('listet alle sieben Attribute mit ihrer Wirkung', () => {
    renderPopup();
    expect(screen.getAllByRole('list')).toHaveLength(4);
    expect(screen.getByText('Speed').tagName).toBe('SPAN');
    expect(screen.getByText('Glück').tagName).toBe('SPAN');
    expect(screen.getAllByText('noch ohne Wirkung')).toHaveLength(3);
  });

  it('zeigt die Spielhistorie aus dem Archiv und nennt die leere Lage', () => {
    const view = renderPopup();
    const section = screen.getByLabelText('Spielhistorie');
    expect(section.textContent).toContain('letzte 1');
    expect(view.career.history[0]!.label).toBe('Duell gegen Rocco');
    expect(screen.getByLabelText('Letzte Etappen').tagName).toBe('UL');
    cleanup();
    renderPopup({ emptyHistory: true });
    expect(screen.getByLabelText('Spielhistorie').textContent).toContain('noch leer');
    expect(screen.getByText(/Noch keine Etappen/).tagName).toBe('P');
  });

  it('nennt Job, Schichten, Tageslohn und letzte Schicht', () => {
    const view = renderPopup();
    expect(screen.getByText('keine Schicht').tagName).toBe('B');
    expect(view.career.job).toBeNull();
  });

  it('zeigt Bilanz, Job und freigeschaltete Erfolge', () => {
    renderPopup();
    expect(screen.getByText('1 S · 0 N · 0 KO').tagName).toBe('B');
    expect(screen.getByText('kein Job').tagName).toBe('B');
    expect(screen.getByText('Eigene Bude gekauft').className).toBe('on');
  });
});

describe('Charakterfenster: Hinterhof-Karriere', () => {
  it('zeigt den naechsten Gegner mit Rang, Startgeld, Preisgeld und Siegchance', () => {
    const view = renderPopup();
    const section = screen.getByLabelText('Hinterhof-Karriere');
    expect(section.textContent).toContain(`Rang ${view.career.backyard.rung.rank} / ${view.career.backyard.totalRungs}`);
    expect(section.textContent).toContain(view.career.backyard.rung.name);
    expect(section.textContent).toContain('Startgeld');
    expect(section.textContent).toContain('Preisgeld');
    expect(section.textContent).toContain(`${view.career.backyard.winChance} % Siegchance`);
  });

  it('fordert den Gegner nur über den vorhandenen Knopf heraus', () => {
    const onChallenge = vi.fn();
    renderPopup({ onChallenge });
    fireEvent.click(screen.getByRole('button', { name: 'Herausfordern' }));
    expect(onChallenge).toHaveBeenCalledTimes(1);
  });

  it('sperrt den Kampf mit Verletzung und nennt den Grund', () => {
    renderPopup({ injured: true });
    expect(screen.getByRole('button', { name: 'Herausfordern' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Verletzt: noch 20 Ticks/).className).toContain('warn');
  });

  it('zeigt die Gegnerhistorie mit Ergebnis und KO aus dem Archiv', () => {
    const view = renderPopup({ backyard: true });
    expect(screen.getByLabelText('Gegnerhistorie').tagName).toBe('UL');
    expect(screen.getByText('1 S · 0 N').tagName).toBe('B');
    expect(screen.getByText(/Tag \d+: Gewonnen · 1 KO/).tagName).toBe('SMALL');
    expect(view.career.record).toEqual({ wins: 2, losses: 0, kos: 1 });
  });
});

describe('Charakterfenster: Immobilie', () => {
  it('zeigt den Katalog mit Preis und sperrt ohne Bargeld', () => {
    const view = renderPopup();
    const section = screen.getByLabelText('Immobilie');
    expect(view.career.property.owned).toBeNull();
    expect(section.textContent).toContain('Gewerberaum');
    expect(screen.getByRole('button', { name: '60.00 VC' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '200.00 VC' }).hasAttribute('disabled')).toBe(true);
  });

  it('kauft nur, was das Portemonnaie deckt, und meldet die Kennung', () => {
    const onBuyProperty = vi.fn();
    renderPopup({ walletVC: 130, onBuyProperty });
    expect(screen.getByRole('button', { name: '60.00 VC' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: '200.00 VC' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '120.00 VC' }));
    expect(onBuyProperty).toHaveBeenCalledWith('KNEIPE');
  });

  it('zeigt nach dem Kauf Besitz, Tag und Preis statt des Katalogs', () => {
    const view = renderPopup({ ownedProperty: true });
    const section = screen.getByLabelText('Immobilie');
    expect(view.career.property.owned).toEqual({ id: 'KNEIPE', priceVC: fromVC(120), day: 3 });
    expect(section.textContent).toContain('in deinem Besitz');
    expect(section.textContent).toContain('Tag 3');
    expect(section.textContent).toContain('Betriebskonto');
    expect(view.career.property.binding?.area?.id).toBe('area-0');
    expect(section.textContent).toContain('Unrenoviert');
    expect(screen.getByRole('button', { name: /Renovieren/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /VC$/ })).toBeNull();
  });
});
