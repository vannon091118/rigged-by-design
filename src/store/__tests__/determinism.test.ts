/**
 * @test-target: src/store/transfer.ts
 * @error-code: ERR-1003
 *
 * Determinismus: derselbe Seed und dieselben Ticks ergeben denselben Spielzustand,
 * und der Export haengt an der Welt statt an der Wanduhr.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { openHouse } from '../../core/sim/money';
import { createWorld } from '../../core/sim/templates';
import { tickWorld } from '../../core/sim/tick';
import { randomSeed } from '../../test/random-seed';
import { exportGameData } from '../transfer';

function run(seed: number, ticks: number): string {
  const world = createWorld('MEDIUM');
  const ledger = new Ledger();
  openHouse(ledger, 0);
  const prng = new Prng(seed);
  for (let step = 0; step < ticks; step += 1) tickWorld(world, ledger, prng);
  expect(ledger.verifyLedgerIntegrity()).toBe(true);
  expect(world.tick).toBe(ticks);
  return exportGameData(world, ledger, prng.getState());
}

describe('Determinismus ohne Wanduhr', () => {
  it('wiederholt aus demselben Seed exakt denselben Verlauf und Export', () => {
    const seed = randomSeed();
    const first = run(seed, 300);
    const second = run(seed, 300);
    expect(second).toBe(first);
  });

  it('trennt verschiedene Seeds in verschiedene Verlaeufe', () => {
    const first = run(randomSeed(), 120);
    const second = run(randomSeed(), 120);
    expect(second).not.toBe(first);
  });

  it('stempelt den Export aus der Welt, nicht aus der Uhr', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    openHouse(ledger, 0);
    const prng = new Prng(randomSeed());
    for (let step = 0; step < 5; step += 1) tickWorld(world, ledger, prng);
    const first = exportGameData(world, ledger, prng.getState());
    const second = exportGameData(world, ledger, prng.getState());
    expect(second).toBe(first);
    expect(first).toContain(`Tag ${world.day}, Tick ${world.tick}`);
  });
});
