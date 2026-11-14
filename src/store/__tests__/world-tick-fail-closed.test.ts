/**
 * @test-target: src/store/tick-scheduler.ts
 * @error-code: ERR-2001
 *
 * Ein Bilanzbruch ist terminal: Der produktive Takt haelt beim ersten Fehler
 * an, ein weiteres Intervall bewegt weder Welt noch Queue, und die Diagnose
 * steht sichtbar in der Meldung. Ein neues Spiel gibt den Takt wieder frei.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { LedgerBalanceError } from '../../core/economy/ledger-tick-guard';
import { fromVC } from '../../core/economy/vacoin';
import { HAUSKONTO } from '../../core/sim/money';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { Prng } from '../../core/rng/prng';
import { advanceWorld } from '../narrative-clock';
import { LedgerHalt } from '../ledger-halt';
import { TickScheduler } from '../tick-scheduler';

function setup() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(10_000), 'takt-kapital', 0);
  const prng = new Prng(424242);
  const broken = new Proxy(ledger, {
    get(target, property) {
      if (property === 'verifyIncremental') return () => false;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Ledger;
  return { world, broken, prng };
}

afterEach(() => { vi.useRealTimers(); });

describe('Welt-Takt nach LedgerBalanceError', () => {
  it('haelt den produktiven Scheduler nach dem ersten Bruch dauerhaft an', () => {
    vi.useFakeTimers();
    const { world, broken, prng } = setup();
    const faults: unknown[] = [];
    const scheduler = new TickScheduler({
      tickMs: 10,
      tick: () => advanceWorld(world, broken, prng),
      onFault: (error) => faults.push(error),
    });

    scheduler.start();
    vi.advanceTimersByTime(10);
    const tickAtFault = world.tick;

    vi.advanceTimersByTime(200);

    expect(faults).toHaveLength(1);
    expect(faults[0]).toBeInstanceOf(LedgerBalanceError);
    expect(scheduler.halted).toBe(true);
    expect(scheduler.start()).toBeUndefined();
    vi.advanceTimersByTime(200);
    expect(world.tick).toBe(tickAtFault);
    expect(faults).toHaveLength(1);
  });

  it('startet nach reset() wieder und tickt erneut', () => {
    vi.useFakeTimers();
    const { world, prng } = setup();
    const healthy = new Ledger();
    healthy.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(10_000), 'takt-kapital', 0);
    let fail = false;
    const scheduler = new TickScheduler({
      tickMs: 10,
      tick: () => {
        if (fail) throw new Error('Tick gerissen');
        advanceWorld(world, healthy, prng);
      },
      onFault: () => {},
    });

    scheduler.start();
    vi.advanceTimersByTime(10);
    const afterFirst = world.tick;
    expect(afterFirst).toBeGreaterThan(0);

    fail = true;
    vi.advanceTimersByTime(10);
    expect(scheduler.halted).toBe(true);

    fail = false;
    scheduler.reset();
    scheduler.start();
    vi.advanceTimersByTime(10);
    expect(world.tick).toBe(afterFirst + 1);
  });

  it('behaelt die erste Diagnose und macht sie sichtbar', () => {
    const halt = new LedgerHalt();
    const first = new LedgerBalanceError(17, 'advanceWorld', 42, 43, null, ['HAUSKONTO'], 'Summe passt nicht');
    const second = new LedgerBalanceError(99, 'advanceWorld', 1, 2, null, ['ANDERES'], 'Folgefehler');

    expect(halt.halt(first)).toBe(true);
    expect(halt.halt(second)).toBe(false);
    expect(halt.active).toBe(true);
    expect(halt.message).toContain('Simulation angehalten');
    expect(halt.message).toContain('Tick 17');
    expect(halt.message).toContain('Summe passt nicht');
    expect(halt.message).not.toContain('Folgefehler');

    halt.clear();
    expect(halt.active).toBe(false);
    expect(halt.message).toBeNull();
  });
});
