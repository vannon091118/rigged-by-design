/**
 * @test-target: src/core/games/slot-transparency.ts
 * @error-code: ERR-1003
 *
 * Rot-Gruen-Beweis: ehrliche Slot-Historie, physikalische Druckstufen und
 * ein Selbstbeherrschungs-Pakt, der als echte Ledger-Buchung endet.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, ZERO_VC } from '../../economy/vacoin';
import { createWorld } from '../../sim/templates';
import { EXTERNAL_WORK, PLAYER_CASH } from '../../sim/money';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { playSlot } from '../engines/slot';
import {
  createSlotMemory, prepareSlotSpin, recordSlotSpin, slotDrift,
} from '../slot-transparency';
import { honorExclusionPact, recordExclusionPlay, startExclusionPact } from '../../sim/self-exclusion-bet';

describe('Slot-Gedächtnis und Drift', () => {
  it('zählt Spins, resettet am Jackpot und berechnet den ehrlichen Drift', () => {
    const memory = createSlotMemory();
    expect(memory.averageJackpotInterval).toBeGreaterThan(100);
    recordSlotSpin(memory, ['J', 'Q', 'K', 'A', 'URN'], 0, false);
    expect(memory.spinsToday).toBe(1);
    expect(memory.spinsSinceLastJackpot).toBe(1);
    expect(slotDrift(memory)).toBe(1 - memory.averageJackpotInterval);
    recordSlotSpin(memory, ['BOOK', 'BOOK', 'BOOK', 'J', 'Q'], 0, true);
    expect(memory.spinsSinceLastJackpot).toBe(0);
    expect(slotDrift(memory)).toBe(-memory.averageJackpotInterval);
  });

  it('führt ein echtes Histogramm über die letzten 100 Spins', () => {
    const memory = createSlotMemory();
    for (let spin = 0; spin < 101; spin += 1) {
      recordSlotSpin(memory, spin === 100 ? ['BOOK', 'BOOK', 'BOOK', 'J', 'Q'] : ['J', 'J', 'J', 'J', 'J'], 0, spin === 100);
    }
    expect(Object.values(memory.recentSymbolHistogram).reduce((sum, count) => sum + count, 0)).toBe(500);
    expect(memory.recentSymbolHistogram.BOOK).toBe(3);
    expect(memory.recentSymbolHistogram.J).toBeGreaterThan(400);
  });
});

describe('Drucklader', () => {
  it('steigt bei Netto-Verlusten bis Level 3 und resettet bei echtem Gewinn', () => {
    const memory = createSlotMemory();
    for (let spin = 0; spin < 3; spin += 1) recordSlotSpin(memory, ['J', 'J', 'J', 'J', 'J'], 0, false);
    expect(memory.pressureLevel).toBe(3);
    recordSlotSpin(memory, ['BOOK', 'BOOK', 'BOOK', 'BOOK', 'BOOK'], 120_000, true);
    expect(memory.pressureLevel).toBe(0);
    expect(memory.chargeReady).toBe(false);
  });

  it('gibt erst bei voller Ladung eine Entladung und nur mit Deckung im Polster', () => {
    const five = createSlotMemory();
    for (let spin = 0; spin < 5; spin += 1) recordSlotSpin(five, ['J', 'J', 'J', 'J', 'J'], 0, false);
    expect(prepareSlotSpin(five).forceWin).toBe(false);

    const seven = createSlotMemory();
    for (let spin = 0; spin < 7; spin += 1) recordSlotSpin(seven, ['J', 'J', 'J', 'J', 'J'], 0, false);
    expect(seven.chargeReady).toBe(true);
    expect(prepareSlotSpin(seven).forceWin).toBe(true);

    const unfunded = createSlotMemory();
    for (let spin = 0; spin < 7; spin += 1) recordSlotSpin(unfunded, ['J', 'J', 'J', 'J', 'J'], 0, false);
    expect(prepareSlotSpin(unfunded, false).forceWin).toBe(false);
    expect(unfunded.chargeReady).toBe(true);
  });

  it('erzwingt eine echte Non-LDW-Auszahlung oberhalb des Standardeinsatzes', () => {
    const outcome = playSlot(new Prng(randomSeed()), { forceWin: true });
    expect(outcome.multiplierBps).toBeGreaterThan(10_000);
    expect(outcome.symbols).toHaveLength(5);
  });
});

describe('Selbstbeherrschungs-Pakt', () => {
  it('bucht den Disziplin-Bonus erst nach der Pause und hält den Ledger integer', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    startExclusionPact(world, ledger, fromVC(100), 0);
    expect(ledger.getBalance(EXTERNAL_WORK)).toBe(fromVC(25));
    recordExclusionPlay(world, fromVC(100), ZERO_VC, 0);
    expect(world.exclusionPact?.status).toBe('LIMIT_REACHED');
    expect(() => honorExclusionPact(world, ledger, 7)).toThrow();
    const result = honorExclusionPact(world, ledger, 8);
    expect(result.ok).toBe(true);
    expect(ledger.getBalance(PLAYER_CASH)).toBe(fromVC(25));
    expect(world.clarityBadge).toBe(true);
    expect(world.playerAddictionScore).toBeLessThan(20);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('registriert einen Wortbruch, wenn nach der Grenze weitergespielt wird', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    startExclusionPact(world, ledger, fromVC(100), 0);
    recordExclusionPlay(world, fromVC(100), ZERO_VC, 0);
    const before = world.playerAddictionScore;
    recordExclusionPlay(world, fromVC(1), ZERO_VC, 1);
    expect(world.brokenExclusionPacts).toBe(1);
    expect(world.exclusionPact?.status).toBe('BROKEN');
    expect(world.playerAddictionScore).toBeGreaterThan(before);
  });
});
