/**
 * @vitest-environment jsdom
 * @test-target: src/ui/games/blackjack-popup.tsx
 * @error-code: ERR-1003
 *
 * Eine laufende Blackjack-Hand darf nicht durch neues Austeilen ersetzt werden,
 * und Verdoppeln braucht Deckung fuer den doppelten Einsatz.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { createCardShoe, startBlackjack } from '../../core/games/engines/interactive-cards';
import { BlackjackPopup } from '../games/blackjack-popup';

afterEach(cleanup);

/** Erster Seed, bei dem der Spieler wirklich am Zug ist (kein Naturals beim Geben). */
function playerTurnSeed(): number {
  for (let seed = 1; seed < 1_000; seed += 1) {
    if (startBlackjack(createCardShoe(seed)).phase === 'PLAYER') return seed;
  }
  throw new Error('Kein Seed mit Spielerzug gefunden.');
}

function table(walletVC: number, seed: number) {
  return render(
    <BlackjackPopup
      title="Testtisch"
      subtitle="Testlauf"
      wallets={{ wallet: fromVC(walletVC), house: fromVC(10) }}
      mods={[]}
      pact="kein Pakt"
      bets={[1]}
      canPay
      full={false}
      onToggleFull={() => {}}
      seed={() => seed}
      onDeal={() => ({ netBps: 10_000, label: 'Test' })}
      onSettle={() => null}
    />,
  );
}

describe('Blackjack-Fenster', () => {
  it('sperrt das Austeilen, solange die Hand laeuft', () => {
    table(10, playerTurnSeed());
    const deal = screen.getByRole('button', { name: /AUSTEILEN/ }) as HTMLButtonElement;
    fireEvent.click(deal);
    expect(deal.disabled).toBe(true);
  });

  it('erlaubt Verdoppeln nur mit Deckung fuer den doppelten Einsatz', () => {
    table(1.5, playerTurnSeed());
    fireEvent.click(screen.getByRole('button', { name: /AUSTEILEN/ }));
    const double = screen.getByRole('button', { name: 'VERDOPPELN' }) as HTMLButtonElement;
    expect(double.disabled).toBe(true);
  });
});
