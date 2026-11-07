/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Speichern, laden und danach exakt dieselbe Simulation fortsetzen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { orderDrinks } from '../../core/sim/deliveries';
import { recordJournal, settleMoneyJournal } from '../../core/sim/journal';
import { hireAgent } from '../../core/sim/staff';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { tickWorld } from '../../core/sim/tick';
import { Prng } from '../../core/rng/prng';
import { buildView } from '../snapshot';
import { replaySave, toSavedGame } from '../save';
import { randomSeed } from '../../test/random-seed';
import { defaultPlinkoConfig, normalizePlinkoConfig } from '../../core/games/plinko-config';

function fixture() {
  const world = createWorld('MEDIUM');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(500), 'baukapital', 0);
  hireAgent(world, ledger, 'porter');
  orderDrinks(world, ledger, 6);
  const prng = new Prng(randomSeed());
  for (let step = 0; step < 40; step += 1) tickWorld(world, ledger, prng);
  settleMoneyJournal(world, ledger);
  recordJournal(world, {
    kind: 'SYSTEM', subject: 'Teststand', cause: 'Roundtrip', effect: 'Alles gespeichert.',
  });
  world.look = { skin: '#b97c4b', hair: '#d9b35c', outfit: '#ff2e88', accessory: 'GLASSES' };
  world.plinko = normalizePlinkoConfig({
    ...defaultPlinkoConfig(), pegs: [{ row: 1, column: 2, kind: 'MAGNET_PEG' }],
  });
  world.plinkoMode = 'TWIN';
  world.totalPlinkoDrops = 42;
  world.addictionScore = 12.5;
  world.lastPlinko = { pockets: [0, 8], tracks: [[{ x: 50, y: 8 }], [{ x: 54, y: 8 }]], steps: 1 };
  return { world, ledger };
}

describe('Save-/Load-Roundtrip v8', () => {
  it('behält Journal, Look, Personalstatus und Ledger über JSON', () => {
    const { world, ledger } = fixture();
    const state = randomSeed();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, state)));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.prngState).toBe(state);
    expect(loaded!.world.look).toEqual(world.look);
    expect(loaded!.world.journal.length).toBe(world.journal.length);
    expect(loaded!.world.nextJournalId).toBe(world.nextJournalId);
    expect(loaded!.world.agents[0]!.task).toBe(world.agents[0]!.task);
    expect(loaded!.world.plinko).toEqual(world.plinko);
    expect(loaded!.world.plinkoMode).toBe('TWIN');
    expect(loaded!.world.totalPlinkoDrops).toBe(42);
    expect(loaded!.world.addictionScore).toBe(12.5);
    expect(loaded!.world.lastPlinko).toEqual(world.lastPlinko);
    expect(loaded!.ledger.diagnose().ok).toBe(true);
    expect(loaded!.ledger.entryCount).toBe(ledger.entryCount);
    expect(JSON.stringify(raw).length).toBeLessThan(2_000_000);
  });

  it('setzt nach dem Laden deterministisch an derselben Stelle fort', () => {
    const { world, ledger } = fixture();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const left = replaySave(raw)!;
    const right = replaySave(raw)!;
    const leftPrng = new Prng(left.prngState);
    const rightPrng = new Prng(right.prngState);
    for (let step = 0; step < 120; step += 1) {
      tickWorld(left.world, left.ledger, leftPrng);
      tickWorld(right.world, right.ledger, rightPrng);
    }
    expect(left.world.tick).toBe(right.world.tick);
    expect(left.world.guests).toEqual(right.world.guests);
    expect(left.world.journal).toEqual(right.world.journal);
    expect(left.ledger.snapshot()).toEqual(right.ledger.snapshot());
    expect(buildView(left.world, left.ledger, '')).toEqual(buildView(right.world, right.ledger, ''));
  });
});
