/**
 * @vitest-environment jsdom
 * @test-target: src/ui/guest-context-panel.tsx
 * @error-code: ERR-3001
 *
 * World-first: Der NPC oeffnet ein Objektpanel am Ziel, die Aktionskarte haengt
 * am Weltpunkt, und die Gästezahl im HUD ersetzt den vierten Dock-Einstieg.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import { randomSeed } from '../../test/random-seed';
import { buildView } from '../../store/snapshot';
import { ActionCard } from '../action-card';
import { Dock } from '../dock';
import { GuestContextPanel } from '../guest-context-panel';
import { Hud } from '../hud';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const noop = (): void => {};

function fixture() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  return { view: buildView(world, ledger, ''), guest };
}

describe('World-first UI', () => {
  it('öffnet den Gast als verankertes Objektpanel statt als Vollbild', () => {
    const { view, guest } = fixture();
    const onOverview = vi.fn();
    render(
      <GuestContextPanel
        view={view}
        guestId={guest.id}
        anchor={{ x: 120, y: 240, worldX: 10, worldY: 20 }}
        onClose={noop}
        onOpenOverview={onOverview}
        onPay={noop}
        onServe={noop}
        onCalm={noop}
        onTalk={noop}
        onFight={noop}
        onProfile={noop}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: guest.name });
    expect(dialog.getAttribute('class')).toContain('is-anchored');
    expect(dialog.getAttribute('data-surface')).toBe('object');
    expect(screen.queryByText('WECHSELKASSE')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ALLE OPTIONEN' }));
    expect(onOverview).toHaveBeenCalledWith(guest.id);
  });

  it('hält die Aktionskarte am Weltpunkt und bietet eine Schliessen-Taste', () => {
    render(
      <ActionCard
        actions={[{ id: 'TALK', label: 'Reden', enabled: true }]}
        anchor={{ x: 100, y: 200, worldX: 12, worldY: 24 }}
        onPick={noop}
        onClose={noop}
      />,
    );

    const card = screen.getByRole('group', { name: 'Aktionen' });
    expect(card.getAttribute('class')).toContain('is-anchored');
    expect(card.style.getPropertyValue('--anchor-x')).toBe('100px');
    expect(card.style.getPropertyValue('--anchor-y')).toBe('200px');
    expect(screen.getByRole('button', { name: 'Schliessen' })).not.toBeNull();
  });

  it('macht die Gästezahl zum Welt-Einstieg und lässt den Dock bei drei Ecken', () => {
    const { view } = fixture();
    const onGuests = vi.fn();
    render(
      <Hud
        view={view}
        perspective="operator"
        onPerspective={noop}
        onSkill={noop}
        onGuests={onGuests}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gästeübersicht öffnen' }));
    expect(onGuests).toHaveBeenCalledTimes(1);

    render(
      <Dock
        view={view}
        perspective="operator"
        onPlay={noop}
        onBuild={noop}
        onClean={noop}
        onOpen={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: 'GÄSTE' })).toBeNull();
    for (const label of ['BETRIEB', 'KARTE', 'DU']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull();
    }
  });
});
