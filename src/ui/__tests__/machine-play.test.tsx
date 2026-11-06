/**
 * @vitest-environment jsdom
 * @test-target: src/ui/machine-popup.tsx
 * @error-code: ERR-3001
 *
 * Der Automat behaelt den kostenlosen Betreiber-Testspin und oeffnet fuer den
 * Gast dieselbe Tischbuehne, aber mit dem privaten PORTEMONNAIE.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { recordJournal } from '../../core/sim/journal';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import type { Furniture } from '../../core/sim/types';
import type { GateResult } from '../../core/games/plinko-sandbox';
import type { GameExtras } from '../../core/games/contracts';
import { MachinePopup } from '../machine-popup';

afterEach(cleanup);

function fixture() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(100), 'startkapital', 0);
  ledger.transfer('HAUSKONTO', 'PORTEMONNAIE', fromVC(20), 'testgeld', 0);
  recordJournal(world, { kind: 'MONEY', subject: 'Test', cause: 'Testgeld', effect: 'Gebucht.', amount: 20_000 });
  const slot = world.furniture.find((entry) => entry.gameId === 'SLOT')!;
  const item: Furniture = { ...slot, id: 800, gameId: 'DICE', label: 'Würfeltisch', baseBet: fromVC(1), mods: [], occupants: [] };
  world.furniture.push(item);
  const view = buildView(world, ledger, '');
  const noop = (): void => {};
  const onTest = vi.fn(() => null);
  const onPlay = vi.fn((_bet: number, _options?: GameExtras) => null);
  const ui = render(
    <MachinePopup
      item={item}
      view={view}
      onClose={noop}
      onTest={onTest}
      onRepair={noop}
      onMod={noop}
      onAddReel={noop}
      onBet={noop}
      onSlotOdds={noop}
      onTakeDrink={noop}
      onDeployPlinko={() => ({ ok: true } as GateResult)}
      onPlinkoMode={noop}
      onWithdraw={noop}
      onPlay={onPlay}
      onDeal={() => null}
      onSettle={() => null}
      onAdditionalBet={() => true}
      onShellRound={() => ({ cups: 3, ballCup: 0, moves: [] })}
      onRisk={() => null}
    />,
  );
  return { ui, onPlay, onTest, wallet: ledger.getBalance('PORTEMONNAIE') };
}

describe('Eigener Automat', () => {
  it('wechselt zwischen Betreiber-Testspin und Gasttisch', async () => {
    fixture();
    fireEvent.click(screen.getByRole('button', { name: 'ALS GAST SPIELEN' }));
    // Der Gasttisch kommt aus einem eigenen Chunk; unter Volllast braucht der Import mehr als 1 s.
    expect(await screen.findByText(/Dein Casino/, undefined, { timeout: 3_000 })).not.toBeNull();
    expect(screen.getByText('PORTEMONNAIE')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'BETREIBER' }));
    expect(screen.getByRole('button', { name: 'TESTSPIN' })).not.toBeNull();
  });

  it('ruft den Testspin ohne Geldeinsatz auf', async () => {
    const { onPlay, onTest } = fixture();
    fireEvent.click(screen.getByRole('button', { name: 'TESTSPIN' }));
    await waitFor(() => expect(onTest).toHaveBeenCalledTimes(1));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('reicht einen Gastwurf als eigenen Spielzug weiter', async () => {
    const { onPlay, wallet } = fixture();
    fireEvent.click(screen.getByRole('button', { name: 'ALS GAST SPIELEN' }));
    const wager = await screen.findByRole('button', { name: /WUERFELN/ });
    fireEvent.click(wager);
    expect(onPlay).toHaveBeenCalledWith(1, { variant: 'UNDER' });
    expect(wallet).toBe(fromVC(20));
  });
});
