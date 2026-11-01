/**
 * @vitest-environment jsdom
 * @test-target: src/ui/games/blackjack-popup.tsx
 * @error-code: ERR-1003
 *
 * Eine laufende Blackjack-Hand darf nicht durch neues Austeilen ersetzt werden,
 * Zusatz-Einsaetze muessen genau einmal und vor der Abrechnung gebucht werden,
 * und die Engine-Quote darf nicht durch einen veralteten Popup-State verfaelscht werden.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { DEFAULT_BLACKJACK_RULES } from '../../core/games/engines/blackjack';
import { createCardShoe, startBlackjack } from '../../core/games/engines/interactive-cards';
import { BlackjackPopup } from '../games/blackjack-popup';

afterEach(cleanup);

/** Erster Seed, bei dem der Spieler wirklich am Zug ist (kein Natural beim Geben). */
function playerTurnSeed(): number {
  for (let seed = 1; seed < 1_000; seed += 1) {
    const round = startBlackjack(createCardShoe(seed, DEFAULT_BLACKJACK_RULES.decks), 1, DEFAULT_BLACKJACK_RULES, false);
    if (round.phase === 'PLAYER' && !round.insuranceOffered) return seed;
  }
  throw new Error('Kein Seed mit Spielerzug gefunden.');
}

/** Erster Seed, bei dem der Spieler sofort einen Natural hat und der Dealer kein Ass zeigt. */
function naturalSeed(): number {
  for (let seed = 1; seed < 5_000; seed += 1) {
    const round = startBlackjack(createCardShoe(seed, DEFAULT_BLACKJACK_RULES.decks), 1, DEFAULT_BLACKJACK_RULES, false);
    if (round.phase === 'DONE' && round.outcome === 'BLACKJACK') return seed;
  }
  throw new Error('Kein Natural-Seed gefunden.');
}

/** Erster Seed, bei dem der Dealer ein Ass zeigt und Versicherung angeboten wird. */
function insuranceSeed(): number {
  for (let seed = 1; seed < 5_000; seed += 1) {
    if (startBlackjack(createCardShoe(seed, DEFAULT_BLACKJACK_RULES.decks), 1, DEFAULT_BLACKJACK_RULES, false).insuranceOffered) return seed;
  }
  throw new Error('Kein Versicherungs-Seed gefunden.');
}

interface Handlers {
  readonly onDeal?: (stake: number) => void;
  readonly onSettle?: (stake: number, bps: number) => void;
  readonly onAdditional?: (amount: number) => void;
}

function table(walletVC: number, seed: number, handlers: Handlers = {}) {
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
      onDeal={(stake) => {
        handlers.onDeal?.(stake);
        return { seed, label: 'Test' };
      }}
      onSettle={(stake, bps) => {
        handlers.onSettle?.(stake, bps);
        return null;
      }}
      onAdditionalBet={(amount) => {
        handlers.onAdditional?.(amount);
        return true;
      }}
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

  it('erlaubt Verdoppeln mit Deckung fuer einen zusätzlichen Einsatz', () => {
    table(1.0, playerTurnSeed());
    fireEvent.click(screen.getByRole('button', { name: /AUSTEILEN/ }));
    const double = screen.getByRole('button', { name: 'VERDOPPELN' }) as HTMLButtonElement;
    expect(double.disabled).toBe(false);
  });

  it('rechnet einen Natural sofort mit der Engine-Quote ab', () => {
    const settlements: Array<{ stake: number; bps: number }> = [];
    table(10, naturalSeed(), { onSettle: (stake, bps) => settlements.push({ stake, bps }) });
    fireEvent.click(screen.getByRole('button', { name: /AUSTEILEN/ }));
    expect(settlements[0]).toEqual({ stake: 1, bps: 25_000 });
  });

  it('bucht die Paar-Wette genau einmal mit dem Austeilen', () => {
    const deals: number[] = [];
    const additional: number[] = [];
    table(10, playerTurnSeed(), { onDeal: (stake) => deals.push(stake), onAdditional: (amount) => additional.push(amount) });
    fireEvent.click(screen.getByRole('button', { name: 'Paar-Wette' }));
    fireEvent.click(screen.getByRole('button', { name: /AUSTEILEN/ }));
    expect(deals).toEqual([2]);
    expect(additional).toEqual([]);
  });

  it('bucht die Versicherung mit dem halben Einsatz', () => {
    const additional: number[] = [];
    table(10, insuranceSeed(), { onAdditional: (amount) => additional.push(amount) });
    fireEvent.click(screen.getByRole('button', { name: /AUSTEILEN/ }));
    fireEvent.click(screen.getByRole('button', { name: 'VERSICHERUNG NEHMEN' }));
    expect(additional).toEqual([0.5]);
  });
});
