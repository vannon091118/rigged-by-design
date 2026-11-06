/**
 * @test-target: src/core/sim/own-play.ts
 * @error-code: ERR-1002
 *
 * Der eigene Geldweg laeuft fuer alle acht Spiele ausschliesslich ueber
 * PORTEMONNAIE und HAUSKONTO; fremde Konten und der Ledger bleiben sauber.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { createShellRound, ballAfterMoves } from '../../games/shell-round';
import { testSpin, foreignRound } from '../actions';
import { DEBT_ACCOUNT, EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../money';
import { isOwnCardGame, ownBet, ownCardDeal, ownCardSettle, ownRisk, ownWin, playOwnRound } from '../own-play';
import { createWorld } from '../templates';
import { TX_REASON } from '../tx-reasons';
import type { GameExtras, GameResult } from '../../games/contracts';
import type { Furniture, GameId } from '../types';
import { createSlotMemory } from '../../games/slot-transparency';
import { randomSeed } from '../../../test/random-seed';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'POKER', 'VIDEO_POKER', 'ROULETTE', 'PLINKO', 'SHELL', 'DICE'];
const BET_VC = 2;

function setup(walletVC = 20, houseVC = 100) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, HAUSKONTO, fromVC(houseVC), 'startkapital', 0);
  ledger.transfer(HAUSKONTO, PORTEMONNAIE, fromVC(walletVC), 'testgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed() || 1) };
}

function machine(world: ReturnType<typeof createWorld>, game: GameId, id: number): Furniture {
  const base = world.furniture.find((item) => item.gameId === 'SLOT')!;
  const copy: Furniture = {
    ...base, id, gameId: game, label: game, baseBet: fromVC(1), mods: [], occupants: [],
    damaged: false, condition: 100, reels: 3,
  };
  if (game === 'SLOT') copy.slotMemory = createSlotMemory(3);
  world.furniture.push(copy);
  return copy;
}

function optionsFor(game: GameId, prng: Prng): GameExtras {
  if (game === 'PLINKO') return { captureTrack: true };
  if (game === 'SHELL') {
    const round = createShellRound(prng);
    return { shell: { round, pick: ballAfterMoves(round) } };
  }
  return {};
}

function runGame(
  world: ReturnType<typeof createWorld>, ledger: Ledger, item: Furniture, prng: Prng, betVC = BET_VC, options: GameExtras = {},
): GameResult {
  if (isOwnCardGame(item.gameId)) {
    const deal = ownCardDeal(world, ledger, item.id, betVC, prng);
    expect(deal).not.toBeNull();
    return ownCardSettle(world, ledger, item.id, betVC, 20_000, item.label);
  }
  return playOwnRound(world, ledger, item.id, betVC, prng, options);
}

describe('Eigener Geldweg', () => {
  for (const game of GAMES) {
    it(`bucht ${game} mit Einsatz, Ergebnis und sauberem Ledger`, () => {
      const { world, ledger, prng } = setup();
      const item = machine(world, game, 300 + GAMES.indexOf(game));
      const before = ledger.getBalance(PORTEMONNAIE);
      const result = runGame(world, ledger, item, prng, BET_VC, optionsFor(game, prng));
      expect(result.game).toBe(game);
      expect(result.stake).toBe(fromVC(BET_VC));
      expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - result.stake + result.payout);
      const ownEntries = ledger.entries.slice(2);
      expect(ownEntries.length).toBeGreaterThan(0);
      expect(ownEntries.every((entry) => entry.reason === TX_REASON.OWN_STAKE || entry.reason === TX_REASON.OWN_WIN)).toBe(true);
      expect(ledger.diagnose().ok).toBe(true);
    });

    it(`weist bei ${game} ungueltigen und ungedeckten Einsatz ohne Buchung ab`, () => {
      const invalid = setup();
      const invalidItem = machine(invalid.world, game, 400 + GAMES.indexOf(game));
      const entries = invalid.ledger.entryCount;
      const state = invalid.prng.getState();
      expect(() => runGame(invalid.world, invalid.ledger, invalidItem, invalid.prng, 0)).toThrow(/Einsatz/);
      expect(invalid.ledger.entryCount).toBe(entries);
      expect(invalid.prng.getState()).toBe(state);

      const empty = setup(0.5);
      const emptyItem = machine(empty.world, game, 500 + GAMES.indexOf(game));
      const emptyEntries = empty.ledger.entryCount;
      const emptyState = empty.prng.getState();
      expect(() => runGame(empty.world, empty.ledger, emptyItem, empty.prng, BET_VC,
        game === 'SHELL' ? { shell: { round: { cups: 3, ballCup: 0, moves: [] }, pick: 0 } } : {},
      )).toThrow(/Bargeld/);
      expect(empty.ledger.entryCount).toBe(emptyEntries);
      expect(empty.prng.getState()).toBe(emptyState);
    });
  }

  it('bucht Verlust ins Haus und deckt einen Gewinn notfalls als Verbindlichkeit', () => {
    const ledger = new Ledger();
    ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(5), 'testgeld', 0);
    ownBet(ledger, fromVC(1), 1);
    expect(ledger.getBalance(HAUSKONTO)).toBe(fromVC(1));
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(4));
    ownWin(ledger, fromVC(20), 2);
    expect(ledger.getBalance(HAUSKONTO)).toBe(0);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(24));
    expect(ledger.getBalance(DEBT_ACCOUNT)).toBe(-fromVC(19));
    expect(ledger.diagnose().ok).toBe(true);
  });

  it('verlangt den Geraetemindesteinsatz und bucht die Risiko-Karte sauber', () => {
    const low = setup();
    const lowItem = machine(low.world, 'SLOT', 650);
    lowItem.baseBet = fromVC(2);
    expect(() => playOwnRound(low.world, low.ledger, lowItem.id, 1, low.prng)).toThrow(/Mindesteinsatz/);
    expect(low.ledger.entryCount).toBe(2);

    const { world, ledger, prng } = setup();
    const item = machine(world, 'SLOT', 651);
    const before = ledger.getBalance(PORTEMONNAIE);
    const risk = ownRisk(world, ledger, item.id, 5, 'ROT', prng);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before + (risk.won ? fromVC(5) : -fromVC(5)));
    expect(risk.payout).toBe(risk.won ? fromVC(10) : 0);
    expect(ledger.diagnose().ok).toBe(true);
  });

  it('laesst den Testspin ohne Ledger- und RNG-Wirkung', () => {
    const { world, ledger, prng } = setup();
    const item = machine(world, 'SLOT', 600);
    const entries = ledger.entryCount;
    const state = prng.getState();
    const before = ledger.snapshot();
    expect(testSpin(item, world, 1234).game).toBe('SLOT');
    expect(ledger.entryCount).toBe(entries);
    expect(ledger.snapshot()).toEqual(before);
    expect(prng.getState()).toBe(state);
  });

  it('haelt fremde Spiele auf dem EXTERNAL-Konto und aus dem eigenen Haus', () => {
    const { ledger, prng } = setup();
    const house = ledger.getBalance(HAUSKONTO);
    const result = foreignRound(ledger, 'DICE', fromVC(1), prng, 0, 0);
    expect(result.game).toBe('DICE');
    expect(ledger.getBalance(HAUSKONTO)).toBe(house);
    const foreign = ledger.entries.slice(-(result.payout > 0 ? 2 : 1));
    expect(foreign.every((entry) => entry.from === EXTERNAL || entry.to === EXTERNAL)).toBe(true);
  });
});
