/**
 * @vitest-environment jsdom
 * @test-target: src/ui/onboarding-panel.tsx
 * @error-code: ERR-3001
 *
 * Der Startpfad als geführter Weg: je Schritt genau ein Modal, und im Raum
 * führt der Schritt zur Starter-Kiste statt zu einem Auftrag ohne Gerät (#534).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { worldStore } from '../../store/use-world-store';
import { OnboardingPanel } from '../onboarding-panel';
import { OpeningGate } from '../opening-card';

const noop = (): void => {};

beforeEach(() => {
  worldStore.newGame('SMALL');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('Startschritte', () => {
  it('zeigt je Startschritt genau ein Modal: Eröffnung, Wohnung, Stadt, Raum, keins', () => {
    const both = (): ReturnType<typeof render> => render(
      <>
        <OpeningGate />
        <OnboardingPanel view={worldStore.getSnapshot()} onOpen={noop} />
      </>,
    );
    const modals = (): number =>
      (screen.queryByLabelText('Eröffnung') ? 1 : 0) + (screen.queryByLabelText('Erste Schritte') ? 1 : 0);

    // OPENING: die Eröffnung allein.
    const opening = both();
    expect(modals()).toBe(1);
    expect(screen.getByLabelText('Eröffnung')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'LOS' }));
    opening.unmount();

    const step = (tip: string, action: string): void => {
      const { unmount } = both();
      expect(modals()).toBe(1);
      expect(screen.getByLabelText('Erste Schritte').textContent).toContain(tip);
      fireEvent.click(screen.getByRole('button', { name: action }));
      unmount();
    };

    step('Du bist zu Hause', 'HAUSTÜR ÖFFNEN');
    step('Die Stadt wartet', 'CASINO BETRETEN');

    // Der Raum-Schritt führt zur Kiste; der Auftrag ist erst mit einem Gerät zu haben.
    const room = both();
    expect(screen.getByLabelText('Erste Schritte').textContent).toContain('Der Raum ist dein');
    expect(screen.getByLabelText('Erste Schritte').textContent).toContain('Starter-Kiste');
    expect(screen.queryByRole('button', { name: 'AUFTRAG ANNEHMEN' })).toBeNull();
    room.unmount();
    worldStore.scene.finishOnboarding();

    // DONE: kein Startmodal mehr.
    both();
    expect(modals()).toBe(0);
  });

  it('führt im Raum-Schritt zur Starter-Kiste und vergibt den Auftrag erst mit einem Gerät', () => {
    const world = createWorld('SMALL');
    world.scene = { kind: 'OWN' };
    world.onboarding = { step: 'CASINO' };
    world.furniture = world.furniture.filter((item) => !item.gameId);
    world.crates = [{ id: 1, payload: { kind: 'FURNITURE', buildId: 'SLOT' }, x: 4, y: 4, carriedBy: null }];
    const waiting = render(<OnboardingPanel view={buildView(world, new Ledger(), '')} onOpen={noop} />);
    const text = screen.getByLabelText('Erste Schritte').textContent ?? '';
    expect(text).toContain('Der Raum ist dein');
    expect(text).toContain('Starter-Kiste');
    expect(screen.queryByRole('button', { name: 'AUFTRAG ANNEHMEN' })).toBeNull();
    waiting.unmount();

    world.crates = [{ id: 1, payload: { kind: 'FURNITURE', buildId: 'SLOT' }, x: 4, y: 4, carriedBy: 'player' }];
    const carried = render(<OnboardingPanel view={buildView(world, new Ledger(), '')} onOpen={noop} />);
    expect(screen.getByLabelText('Erste Schritte').textContent).toContain('Du trägst die Kiste');
    carried.unmount();

    // Mit stehendem Automaten ist der Auftrag zu haben; der Nachlade-Pfad heilt
    // nur noch, wenn keine Kiste mehr auf ihre Montage wartet.
    world.crates = [];
    ensureStarter(world);
    render(<OnboardingPanel view={buildView(world, new Ledger(), '')} onOpen={noop} />);
    expect(screen.getByRole('button', { name: 'AUFTRAG ANNEHMEN' })).not.toBeNull();
  });
});
