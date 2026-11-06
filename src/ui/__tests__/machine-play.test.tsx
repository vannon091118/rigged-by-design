/**
 * @vitest-environment jsdom
 * @test-target: src/ui/machine-popup.tsx
 * @error-code: ERR-3001
 *
 * Der Betrieb behält den kostenlosen Diagnose-Testspin. Der Gast bekommt ohne
 * internen Rollentoggle direkt dieselbe Tischbühne mit dem PORTEMONNAIE.
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
import type { Perspective } from '../app-model';
import { MachinePopup } from '../machine-popup';

afterEach(cleanup);

function fixture(perspective: Perspective) {
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
  render(
    <MachinePopup
      item={item}
      view={view}
      perspective={perspective}
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
  return { onPlay, onTest, wallet: ledger.getBalance('PORTEMONNAIE') };
}

describe('Eigener Automat', () => {
  it('öffnet im Gastmodus direkt die vorhandene Spielbühne', async () => {
    fixture('guest');
    expect(await screen.findByText(/Dein Casino/, {}, { timeout: 3000 })).not.toBeNull();
    expect(screen.getByText('PORTEMONNAIE')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'TESTSPIN' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ALS GAST SPIELEN' })).toBeNull();
  });

  it('zeigt im Betriebsmodus Diagnose statt der Spielbühne', () => {
    fixture('operator');
    expect(screen.getByRole('button', { name: 'TESTSPIN' })).not.toBeNull();
    expect(screen.queryByText(/Dein Casino/)).toBeNull();
  });

  it('ruft den Testspin ohne Geldeinsatz auf', async () => {
    const { onPlay, onTest } = fixture('operator');
    fireEvent.click(screen.getByRole('button', { name: 'TESTSPIN' }));
    await waitFor(() => expect(onTest).toHaveBeenCalledTimes(1));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('reicht einen Gastwurf als eigenen Spielzug weiter', async () => {
    const { onPlay, wallet } = fixture('guest');
    const wager = await screen.findByRole('button', { name: /WUERFELN/ });
    fireEvent.click(wager);
    expect(onPlay).toHaveBeenCalledWith(1, { variant: 'UNDER' });
    expect(wallet).toBe(fromVC(20));
  });
});
