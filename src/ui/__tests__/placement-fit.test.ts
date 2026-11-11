/**
 * @test-target: src/ui/app-model.ts
 * @error-code: ERR-3001
 *
 * Das Ablegen per Enter stellt am eigenen Feld ab; die eigene Kachel darf
 * deshalb kein Blocker sein, eine fremde Gastkachel aber schon.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { spawnGuest } from '../../core/sim/spawn';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { fits } from '../app-model';

function fresh() {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  return { world, ledger: new Ledger(), prng: new Prng(randomSeed()) };
}

describe('Platzierung auf dem eigenen Feld', () => {
  it('erlaubt das Ablegen auf der Kachel des Spielers', () => {
    const { world, ledger } = fresh();
    world.player.position = { x: 15, y: 8 };
    const view = buildView(world, ledger, '');
    expect(fits(view, 'SLOT', 15, 8)).toBe(true);
  });

  it('blockiert weiterhin die Kachel eines Gastes', () => {
    const { world, ledger, prng } = fresh();
    world.player.position = { x: 5, y: 14 };
    const guest = spawnGuest(world, prng, ledger);
    expect(guest).not.toBeNull();
    guest!.position = { x: 15, y: 8 };
    const view = buildView(world, ledger, '');
    expect(fits(view, 'SLOT', 15, 8)).toBe(false);
  });
});
