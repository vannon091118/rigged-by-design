/** @test-target: src/core/sim/visitors.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { pickReturningVisitor, returnChance, VISITOR_CAP, recordVisitor, noteExperience } from '../visitors';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { replaySave } from '../../../store/save';
import { randomSeed } from '../../../test/random-seed';

function setup(seed = randomSeed()) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(seed);
  return { world, ledger, prng };
}

describe('Besucherprofile', () => {
  it('legt beim ersten Besuch ein Profil an und verknuepft den Gast damit', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger);
    expect(guest).not.toBeNull();
    expect(world.visitors).toHaveLength(1);
    expect(world.visitors[0]).toMatchObject({ visits: 1, name: guest!.name, persona: guest!.persona });
    expect(guest!.visitorId).toBe(world.visitors[0]!.id);
  });

  it('erkennt einen Stammgast wieder und zaehlt seine Besuche hoch', () => {
    const { world, ledger, prng } = setup();
    const first = spawnGuest(world, prng, ledger);
    expect(first).not.toBeNull();
    const profileId = first!.visitorId;
    world.guests = [];
    // Die Rueckkehrer-Auswahl ist deterministisch aus der Gast-ID; einen
    // passenden ID-Wert suchen, statt hunderte Zufallsgaeste zu spawnen.
    let returningId = 0;
    for (let id = 1; id <= 100 && returningId === 0; id += 1) {
      if (pickReturningVisitor(world, id)?.id === profileId) returningId = id;
    }
    expect(returningId).toBeGreaterThan(0);
    world.nextGuestId = returningId;
    const returned = spawnGuest(world, prng, ledger);
    expect(returned).not.toBeNull();
    expect(returned!.name).toBe(first!.name);
    expect(returned!.persona).toBe(first!.persona);
    expect(world.visitors.filter((visitor) => visitor.id === profileId)).toHaveLength(1);
    expect(world.visitors.find((visitor) => visitor.id === profileId)!.visits).toBeGreaterThan(1);
  });

  it('begrenzt die Liste auf VISITOR_CAP und verdraengt zuerst den am laengsten nicht gesehenen', () => {
    const world = createWorld('SMALL');
    for (let i = 0; i < VISITOR_CAP + 10; i += 1) {
      recordVisitor(world, { name: `G${i}`, persona: 'STREET', tick: i });
    }
    expect(world.visitors.length).toBeLessThanOrEqual(VISITOR_CAP);
    expect(world.visitors.some((visitor) => visitor.name === `G${VISITOR_CAP + 9}`)).toBe(true);
    expect(world.visitors.some((visitor) => visitor.name === 'G0')).toBe(false);
  });

  it('kehrt nach schlechtem Erlebnis kaum zurueck und nach gutem oefter', () => {
    const world = createWorld('SMALL');
    const profile = recordVisitor(world, { name: 'Test Gast', persona: 'STREET', tick: 1 });
    const countReturns = () => {
      let count = 0;
      for (let id = 1; id <= 2000; id += 1) {
        if (pickReturningVisitor(world, id)) count += 1;
      }
      return count;
    };
    noteExperience(world, profile.id, 0);
    expect(returnChance(profile)).toBe(0);
    expect(countReturns()).toBe(0);
    noteExperience(world, profile.id, 50);
    const neutral = countReturns();
    noteExperience(world, profile.id, 100);
    expect(returnChance(profile)).toBeGreaterThan(25);
    expect(countReturns()).toBeGreaterThan(neutral);
  });

  it('bleibt beim Laden erhalten; alte Staende starten ohne Profile', () => {
    const v7 = {
      version: 7, template: 'SMALL', carpet: 'VIOLET', furniture: [], guests: [],
      player: { position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '' },
      dirty: [], prices: createWorld('SMALL').prices, staff: createWorld('SMALL').staff,
      tick: 3, day: 1, nextGuestId: 1, nextFurnitureId: 100, guardsHired: 0,
      lastEvent: '', entries: [], prngState: 9,
      visitors: [{ id: 4, name: 'Rita Kern', persona: 'STAMMGAST', visits: 3, lastSeenTick: 2 }],
      nextVisitorId: 5,
    };
    const loaded = replaySave(v7)!;
    expect(loaded.world.visitors).toEqual(v7.visitors);
    expect(loaded.world.nextVisitorId).toBe(5);
    const legacy = replaySave({ ...v7, version: 6, visitors: undefined, nextVisitorId: undefined })!;
    expect(legacy.world.visitors).toEqual([]);
    expect(legacy.world.nextVisitorId).toBe(1);
  });
});
