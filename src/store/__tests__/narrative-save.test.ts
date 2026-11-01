/** @test-target: src/store/save.ts | @error-code: ERR-1003 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { openHouse } from '../../core/sim/money';
import { createNarrativeState, seedStartPool } from '../../core/sim/narrative/state';
import { tickWorld } from '../../core/sim/tick';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { replaySave, toSavedGame } from '../save';

function fixture() {
  const world = createWorld('MEDIUM');
  ensureStarter(world);
  const ledger = new Ledger();
  seedStartPool(world, openHouse(ledger, 0));
  const prng = new Prng(randomSeed());
  for (let step = 0; step < 60; step += 1) tickWorld(world, ledger, prng);
  return { world, ledger };
}

describe('Save v9 bewahrt die Narrative-Domaene', () => {
  it('erhaelt Facts, Flags und Erinnerungen ueber JSON', () => {
    const { world, ledger } = fixture();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.narrative).toEqual(world.narrative);
    expect(loaded!.world.narrative.flags.startkapital).toBeGreaterThan(0);
    expect(loaded!.world.visitors).toEqual(world.visitors);
  });

  it('laedt v8 ohne Narrative-Feld mit sicheren Defaults', () => {
    const { world, ledger } = fixture();
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 7))) as Record<string, unknown>;
    saved.version = 8;
    delete saved.narrative;
    for (const visitor of saved.visitors as Array<Record<string, unknown>>) delete visitor.memories;
    const loaded = replaySave(saved);
    expect(loaded).not.toBeNull();
    expect(loaded!.world.narrative).toEqual(createNarrativeState());
    expect(loaded!.world.visitors.every((visitor) => (visitor.memories ?? []).length === 0)).toBe(true);
  });

  it('setzt zwei aus demselben Save geladene Welten inklusive Narrative identisch fort', () => {
    const { world, ledger } = fixture();
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, randomSeed())));
    const left = replaySave(raw)!;
    const right = replaySave(raw)!;
    const leftPrng = new Prng(left.prngState);
    const rightPrng = new Prng(right.prngState);
    for (let step = 0; step < 80; step += 1) {
      tickWorld(left.world, left.ledger, leftPrng);
      tickWorld(right.world, right.ledger, rightPrng);
    }
    expect(left.world.narrative).toEqual(right.world.narrative);
    expect(left.world.visitors).toEqual(right.world.visitors);
    expect(left.world.tick).toBe(right.world.tick);
  });
});
