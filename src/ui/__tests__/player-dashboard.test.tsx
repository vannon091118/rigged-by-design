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
  readonly backyard?: boolean;
  readonly injured?: boolean;
}

function renderPopup(options: Options = {}) {
  const world = createWorld('SMALL');
  grantXp(world.player.rpg, 450);
  world.player.barPurchased = true;
  if (options.injured) world.player.rpg.injuryTicks = 20;
  recordJournal(world, {
    kind: 'GUEST', subject: 'Duell gegen Rocco', cause: 'Rädelsführer fordert dich',
    effect: 'Gewonnen: der Rädelsführer ist raus.', refs: {},
  });
  if (options.backyard) {
    recordJournal(world, {
      kind: 'SYSTEM', subject: 'Hinterhof gegen Bulle Bernd', cause: 'Hinterhof-Schläger · Rang 1/6',
      effect: 'Gewonnen: KO in Runde 2 · Preisgeld 1,20 VC.',
    });
  }
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(10), 'test startgeld', 0);
  const view = buildView(world, ledger, 'Hinweis');
  render(<LookPopup view={view} onClose={() => {}} onLook={() => {}} onChallenge={options.onChallenge} />);
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
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getByText('Speed').tagName).toBe('SPAN');
    expect(screen.getByText('Glück').tagName).toBe('SPAN');
    expect(screen.getAllByText('noch ohne Wirkung')).toHaveLength(3);
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
