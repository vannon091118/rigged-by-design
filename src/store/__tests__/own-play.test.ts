/**
 * @test-target: src/store/own-play.ts
 * @error-code: ERR-1002
 *
 * Die Fassade haelt offene Kartenrunden genau einmal, blockiert Doppelbuchungen
 * und gibt den Ledger unveraendert durch Speichern und Laden weiter.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { Prng } from '../../core/rng/prng';
import { createWorld } from '../../core/sim/templates';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../../core/sim/money';
import type { Furniture } from '../../core/sim/types';
import { randomSeed } from '../../test/random-seed';
import { replaySave, toSavedGame } from '../save';
import { OwnPlay } from '../own-play';

function setup(walletVC = 20) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, HAUSKONTO, fromVC(100), 'startkapital', 0);
  ledger.transfer(HAUSKONTO, PORTEMONNAIE, fromVC(walletVC), 'testgeld', 0);
  const prng = new Prng(randomSeed() || 1);
  const notices: string[] = [];
  const own = new OwnPlay({
    world: () => world, ledger: () => ledger, prng: () => prng,
    emit: () => {}, notice: (text) => notices.push(text),
  });
  const slot = world.furniture.find((item) => item.gameId === 'SLOT')!;
  const card: Furniture = { ...slot, id: 700, gameId: 'BLACKJACK', label: 'Blackjack', baseBet: fromVC(1), mods: [], occupants: [] };
  world.furniture.push(card);
  return { world, ledger, prng, own, notices, slot, card };
}

describe('OwnPlay-Fassade', () => {
  it('bucht eine Kartenrunde beim Austeilen und beim Abrechnen genau einmal', () => {
    const { own, ledger, card } = setup();
    const start = ledger.getBalance(PORTEMONNAIE);
    expect(own.deal(card.id, 2)).not.toBeNull();
    expect(own.deal(card.id, 2)).toBeNull();
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(start - fromVC(2));
    const result = own.settle(card.id, 2, 20_000, 'BJ');
    expect(result?.payout).toBe(fromVC(4));
    const entries = ledger.entryCount;
    expect(own.settle(card.id, 2, 20_000, 'BJ')).toBeNull();
    expect(ledger.entryCount).toBe(entries);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(start + fromVC(2));
    expect(ledger.diagnose().ok).toBe(true);
  });

  it('weist eine Abrechnung mit fremdem Einsatz ab und laesst die Runde offen', () => {
    const { own, card } = setup();
    expect(own.deal(card.id, 2)).not.toBeNull();
    expect(own.settle(card.id, 3, 20_000, 'BJ')).toBeNull();
    expect(own.additional(card.id, 1)).toBe(true);
    expect(own.settle(card.id, 2, 20_000, 'BJ')).not.toBeNull();
  });

  it('blockiert zu kleine Einsaetze ohne Buchung und meldet den Grund', () => {
    const { own, ledger, notices, slot } = setup(0.5);
    const entries = ledger.entryCount;
    expect(own.spin(slot.id, 1)).toBeNull();
    expect(ledger.entryCount).toBe(entries);
    expect(notices.some((text) => text.includes('Bargeld'))).toBe(true);
  });

  it('erhaelt alle Geldstaende ueber Speichern und Laden', () => {
    const { world, ledger, prng, own, card } = setup();
    expect(own.deal(card.id, 2)).not.toBeNull();
    expect(own.settle(card.id, 2, 20_000, 'BJ')).not.toBeNull();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.ledger.getBalance(HAUSKONTO)).toBe(ledger.getBalance(HAUSKONTO));
    expect(loaded!.ledger.getBalance(PORTEMONNAIE)).toBe(ledger.getBalance(PORTEMONNAIE));
    expect(loaded!.ledger.entryCount).toBe(ledger.entryCount);
    expect(loaded!.ledger.diagnose().ok).toBe(true);
    expect(loaded!.world.furniture.find((item) => item.id === card.id)?.gameId).toBe('BLACKJACK');
  });
});
