/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1003
 *
 * Speicher- und Save-Groesse: eine definierte 1000-Tick-Sitzung, kein Sample-Ring.
 * Bewusst nicht Teil von verify:all.
 */
import { test } from 'vitest';
import { Ledger } from '../core/economy/ledger';
import { fromVC } from '../core/economy/vacoin';
import { Prng } from '../core/rng/prng';
import { createWorld, ensureStarter } from '../core/sim/templates';
import { tickWorld } from '../core/sim/tick';
import { randomSeed } from '../test/random-seed';
import { toSavedGame } from './save';

test('Speicher und Save-Groesse nach 1000 Ticks', { timeout: 60_000 }, () => {
  const world = createWorld('LARGE');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(10_000), 'speicher-test', 0);
  const prng = new Prng(randomSeed());
  const before = process.memoryUsage().heapUsed;
  const start = process.hrtime.bigint();
  for (let step = 0; step < 1000; step += 1) tickWorld(world, ledger, prng);
  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
  const after = process.memoryUsage().heapUsed;
  const bytes = JSON.stringify(toSavedGame(world, ledger, prng.getState())).length;
  console.log(`ticks: ${elapsed.toFixed(1)} ms (1000 Ticks)`);
  console.log(`heap: ${((after - before) / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`save: ${(bytes / 1024).toFixed(1)} KiB`);
});
