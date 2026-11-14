/**
 * @test-target: src/store/narrative-clock.ts
 * @error-code: ERR-2001
 *
 * Die Bilanz ist eine Invariante des vollstaendigen Takts, nicht nur des
 * Ledger-Moduls. Der Test prueft mehrere feste Seeds ueber einen Spieltag und
 * erkennt einen beschädigten Ledger noch am Ende desselben Takts.
 */
import { describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { LedgerBalanceError } from '../../core/economy/ledger-tick-guard';
import { fromVC } from '../../core/economy/vacoin';
import { TICKS_PER_DAY } from '../../core/sim/clock';
import { HAUSKONTO } from '../../core/sim/money';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { Prng } from '../../core/rng/prng';
import { advanceWorld } from '../narrative-clock';

function start(seed: number): { world: ReturnType<typeof createWorld>; ledger: Ledger; prng: Prng } {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(10_000), 'guard-kapital', 0);
  return { world, ledger, prng: new Prng(seed) };
}

describe('Ledger-Bilanz je Welt-Takt', () => {
  it('prueft nach jedem Takt und bleibt über einen Spieltag integer', () => {
    const { world, ledger, prng } = start(424242);
    const check = vi.spyOn(ledger, 'verifyIncremental');

    for (let step = 0; step < TICKS_PER_DAY; step += 1) {
      advanceWorld(world, ledger, prng);
    }

    expect(check).toHaveBeenCalledTimes(TICKS_PER_DAY);
    expect(world.tick).toBe(TICKS_PER_DAY);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.diagnose().ok).toBe(true);
  });

  it('prueft mehrere feste Seeds ueber je einen vollstaendigen Spieltag', () => {
    for (const seed of [424242, 424243, 424244]) {
      const { world, ledger, prng } = start(seed);
      for (let step = 0; step < TICKS_PER_DAY; step += 1) {
        advanceWorld(world, ledger, prng);
      }
      expect(world.tick).toBe(TICKS_PER_DAY);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
    }
  });

  it('erkennt einen beschaedigten Ledger am Ende desselben Takts', () => {
    const { world, ledger, prng } = start(424242);
    const broken = new Proxy(ledger, {
      get(target, property) {
        if (property === 'verifyIncremental') return () => false;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as Ledger;

    let caught: unknown;
    try {
      advanceWorld(world, broken, prng);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LedgerBalanceError);
    const failure = caught as LedgerBalanceError;
    expect(failure.tick).toBe(world.tick);
    expect(failure.phase).toBe('advanceWorld');
    expect(failure.seq).toBeGreaterThanOrEqual(0);
    expect(failure.accounts.length).toBeGreaterThan(0);
    expect(failure.message).toContain('Ledger-Bilanz gebrochen');
    expect(failure.message).toContain(`Tick ${world.tick}`);
  });
});
