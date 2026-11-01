/** @test-target: src/core/sim/narrative/state.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { seedStartPool } from '../narrative/state';
import { pickReturningVisitor } from '../visitors';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';

describe('Start-Pool der Narrative-Domaene', () => {
  it('legt drei bekannte Figuren an und bucht das Startkapital als Fact', () => {
    const world = createWorld('SMALL');
    seedStartPool(world, fromVC(150));
    expect(world.visitors.map((visitor) => visitor.name)).toEqual(['Rita Kern', 'Boris Falk', 'Mira Sol']);
    expect(world.narrative.flags.startkapital).toBe(fromVC(150));
    expect(world.narrative.flags.startpool).toBe(3);
    expect(world.narrative.pending.map((fact) => fact.kind)).toEqual(['START_POOL', 'START_POOL', 'START_POOL']);
  });

  it('ist idempotent und verdoppelt weder Figuren noch Facts', () => {
    const world = createWorld('SMALL');
    seedStartPool(world, fromVC(150));
    seedStartPool(world, fromVC(150));
    expect(world.visitors).toHaveLength(3);
    expect(world.narrative.pending).toHaveLength(3);
    expect(world.narrative.factSeq).toBe(4);
  });

  it('wirkt ab Tick 0: eine Figur aus dem Pool kehrt sofort als Stammgast zurueck', () => {
    const world = createWorld('SMALL');
    seedStartPool(world, fromVC(150));
    const poolIds = new Set(world.visitors.map((visitor) => visitor.id));
    let guestId = 0;
    for (let id = 1; id <= 200 && guestId === 0; id += 1) {
      const candidate = pickReturningVisitor(world, id);
      if (candidate && poolIds.has(candidate.id)) guestId = id;
    }
    expect(guestId).toBeGreaterThan(0);
    world.nextGuestId = guestId;
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger());
    expect(guest).not.toBeNull();
    expect(poolIds.has(guest!.visitorId!)).toBe(true);
    expect(['Rita Kern', 'Boris Falk', 'Mira Sol']).toContain(guest!.name);
    expect(world.visitors.find((visitor) => visitor.id === guest!.visitorId)!.visits).toBe(2);
  });

  it('laesst eine Welt ohne Start-Pool beim selben Gast ein neues Profil anlegen', () => {
    const control = createWorld('SMALL');
    control.nextGuestId = 5;
    const guest = spawnGuest(control, new Prng(randomSeed()), new Ledger());
    expect(control.visitors).toHaveLength(1);
    expect(guest!.visitorId).toBe(1);
    expect(['Rita Kern', 'Boris Falk', 'Mira Sol']).not.toContain(guest!.name);
  });
});
