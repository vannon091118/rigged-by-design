/**
 * @vitest-environment jsdom
 * @test-target: src/ui/look-popup.tsx
 * @error-code: ERR-3001
 *
 * Das Charakterfenster zeigt Werte aus der Karriere-Sicht, nicht aus einem zweiten Zustand.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { recordJournal } from '../../core/sim/journal';
import { grantXp } from '../../core/sim/player-rpg';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { LookPopup } from '../look-popup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function renderPopup() {
  const world = createWorld('SMALL');
  grantXp(world.player.rpg, 450);
  world.player.barPurchased = true;
  recordJournal(world, {
    kind: 'GUEST', subject: 'Duell gegen Rocco', cause: 'Rädelsführer fordert dich',
    effect: 'Gewonnen: der Rädelsführer ist raus.', refs: {},
  });
  const view = buildView(world, new Ledger(), 'Hinweis');
  render(<LookPopup view={view} onClose={() => {}} onLook={() => {}} />);
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
    expect(screen.getByText('1 S · 0 N').tagName).toBe('B');
    expect(screen.getByText('kein Job').tagName).toBe('B');
    expect(screen.getByText('Eigene Bude gekauft').className).toBe('on');
  });
});
