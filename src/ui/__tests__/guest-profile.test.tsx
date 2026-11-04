/**
 * @vitest-environment jsdom
 * @test-target: src/ui/guest-popup.tsx
 * @error-code: ERR-3001
 *
 * Der Gast-Popup reicht nur die Besucher-ID an den Aufrufer; Profile und
 * Erinnerungen rechnet der Core im Snapshot.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import { randomSeed } from '../../test/random-seed';
import { buildView } from '../../store/snapshot';
import { GuestPopup } from '../guest-popup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const noop = (): void => {};

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  return { view: buildView(world, ledger, ''), guest };
}

describe('Gast-Popup Profilweg', () => {
  it('reicht die Besucher-ID des gewaehlten Gasts an den Profil-Handler', () => {
    const { view, guest } = setup();
    const onProfile = vi.fn();

    render(
      <GuestPopup view={view} selectedId={guest.id} onClose={noop} onPay={noop} onServe={noop}
        onCalm={noop} onTalk={noop} onFight={noop} onProfile={onProfile} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'PROFIL' }));

    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledWith(guest.visitorId);
  });

  it('bietet keinen Profilweg fuer einen Gast ohne Besucher-ID', () => {
    const { view, guest } = setup();
    const anonymous = { ...guest, id: 999, visitorId: undefined };

    render(
      <GuestPopup view={{ ...view, guests: [anonymous] }} selectedId={anonymous.id} onClose={noop}
        onPay={noop} onServe={noop} onCalm={noop} onTalk={noop} onFight={noop} onProfile={noop} />,
    );

    expect(screen.queryByRole('button', { name: 'PROFIL' })).toBeNull();
  });
});
