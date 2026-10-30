/**
 * @test-target: src/core/sim/deliveries.ts
 * @error-code: ERR-2001
 *
 * Käufe kommen als Kiste, Personal arbeitet auf dem Floor, WC verstopft, Umbau braucht Ruf.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { repair } from '../actions';
import { chooseActivity } from '../guest-choice';
import { buyCrate, deliverDrink, deployCrate, depositCrate, orderDrinks, orderParts, takeCrate } from '../deliveries';
import { guestAccount, HAUSKONTO, pendingAccount } from '../money';
import { getBuildDef } from '../offers';
import { remodel } from '../remodel';
import { spawnGuest } from '../spawn';
import { hireAgent, tickAgents } from '../staff';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import type { Furniture, WorldState } from '../types';
import { canPlace, exchangePoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup(seed = randomSeed()) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(2000), 'baukapital', 0);
  return { world, ledger, prng: new Prng(seed) };
}

function freeTile(world: WorldState, w: number, h: number): { x: number; y: number } {
  for (let y = 1; y < world.size - h; y += 1) {
    for (let x = 1; x < world.size - w; x += 1) {
      if (canPlace(world, x, y, w, h, false)) return { x, y };
    }
  }
  throw new Error('kein freies Feld');
}

function ensureKind(setupWorld: WorldState, kind: 'BAR' | 'TOILET'): Furniture {
  const found = setupWorld.furniture.find((item) => item.kind === kind);
  if (found) return found;    throw new Error('Starter unvollständig');
}

describe('Lieferkette', () => {
  it('ein Kauf erzeugt eine Kiste am Eingang, kein Möbel', () => {
    const { world, ledger } = setup();
    const before = world.furniture.length;
    const house = ledger.getBalance(HAUSKONTO);
    buyCrate(world, ledger, 'SLOT');
    expect(world.furniture).toHaveLength(before);
    expect(world.crates).toHaveLength(1);
    expect(ledger.getBalance(HAUSKONTO)).toBeLessThan(house);
  });

  it('Abholen und Aufstellen bringt das Möbel auf den Floor', () => {
    const { world, ledger } = setup();
    const before = world.furniture.length;
    const crate = buyCrate(world, ledger, 'PLANT');
    const def = getBuildDef('PLANT');
    const spot = freeTile(world, def.w, def.h);
    const carried = takeCrate(world, crate.id);
    expect(carried.carriedBy).toBe('player');
    const item = deployCrate(world, carried.id, spot.x, spot.y);
    expect(item.kind).toBe('DECOR');
    expect(world.furniture).toHaveLength(before + 1);
  });

  it('eine volle Bar schwenkt um: leere Bar verdirbt die Laune', () => {
    const { world, ledger, prng } = setup();
    const bar = ensureKind(world, 'BAR');
    orderDrinks(world, ledger, 4);
    const crate = world.crates[world.crates.length - 1]!;
    takeCrate(world, crate.id);
    depositCrate(world, crate.id, bar.x, bar.y, bar.id);
    expect(bar.stock).toBeGreaterThan(0);
    bar.stock = 0;
    const guest = spawnGuest(world, prng, ledger)!;
    const mood = (guest.mood = 70);
    deliverDrink(world, ledger, guest, bar);
    expect(guest.mood).toBeLessThan(mood);
    expect(guest.need).toBe('drink');
  });

  it('eine Reparatur braucht Ersatzteile aus dem Lager', () => {
    const { world, ledger } = setup();
    world.parts = 0;
    const target = world.furniture[0]!;
    target.condition = 40;
    expect(() => repair(world, ledger, target.id)).toThrow();
    orderParts(world, ledger, 2);
    const crate = world.crates[world.crates.length - 1]!;
    takeCrate(world, crate.id);
    const storage = world.zones.find((zone) => zone.id === 'storage') ?? world.zones[0]!;
    depositCrate(world, crate.id, storage.x, storage.y);
    expect(world.parts).toBeGreaterThan(0);
    const parts = world.parts;
    repair(world, ledger, target.id);
    expect(target.condition).toBe(100);
    expect(world.parts).toBe(parts - 1);
  });

  it('ein verstopftes WC wird gemieden und repariert', () => {
    const { world, ledger, prng } = setup();
    const wc = ensureKind(world, 'TOILET');
    wc.clogged = true;
    const guest = spawnGuest(world, prng, ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
    guest.state = 'CHOOSE';
    guest.bladder = 95;
    guest.thirst = 5;
    chooseActivity(world, guest, ledger, prng);
    expect(guest.state).not.toBe('TOILET');
    orderParts(world, ledger, 1);
    const crate = world.crates[world.crates.length - 1]!;
    takeCrate(world, crate.id);
    const storage = world.zones.find((zone) => zone.id === 'storage') ?? world.zones[0]!;
    depositCrate(world, crate.id, storage.x, storage.y);
    repair(world, ledger, wc.id);
    expect(wc.clogged).toBe(false);
  });
});

describe('Personal', () => {
  it('Lohn läuft täglich über das Ledger', () => {
    const { world, ledger, prng } = setup();
    hireAgent(world, ledger, 'cashier');
    const staffBefore = ledger.getBalance('STAFF');
    world.tick = 599;
    for (let i = 0; i < 3; i += 1) tickWorld(world, ledger, prng);
    expect(ledger.getBalance('STAFF')).toBeGreaterThan(staffBefore);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('der Portier trägt Ersatzteile ins Lager', () => {
    const { world, ledger, prng } = setup();
    world.parts = 0;
    orderParts(world, ledger, 3);
    hireAgent(world, ledger, 'porter');
    for (let i = 0; i < 400 && world.parts === 0; i += 1) tickAgents(world, ledger, prng);
    expect(world.parts).toBe(3);
    expect(world.crates).toHaveLength(0);
  });

  it('der Kassierer verkürzt die Auszahlungs-Wartezeit', () => {
    const seed = randomSeed();
    const fast = setup(seed);
    const slow = setup(seed);
    const refs: { world: WorldState; id: number }[] = [];
    for (const { world, ledger, prng } of [fast, slow]) {
      const guest = spawnGuest(world, prng, ledger)!;
      ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'chips', 0);
      ledger.transfer('EXTERNAL_WORLD', pendingAccount(guest.id), fromVC(2), 'gewinn', 0);
      guest.state = 'CASHOUT';
      guest.position = { ...exchangePoint(world)! };
      guest.path = [];
      refs.push({ world, id: guest.id });
    }
    hireAgent(fast.world, fast.ledger, 'cashier');
    let fastTicks = -1;
    let slowTicks = -1;
    const gone = (world: WorldState, id: number): boolean => !world.guests.some((entry) => entry.id === id);
    for (let i = 0; i < 40; i += 1) {
      if (fastTicks < 0) {
        tickWorld(fast.world, fast.ledger, fast.prng);
        if (gone(fast.world, refs[0]!.id)) fastTicks = i;
      }
      if (slowTicks < 0) {
        tickWorld(slow.world, slow.ledger, slow.prng);
        if (gone(slow.world, refs[1]!.id)) slowTicks = i;
      }
    }
    expect(fastTicks).toBeGreaterThanOrEqual(0);
    expect(slowTicks).toBeGreaterThanOrEqual(0);
    expect(fastTicks).toBeLessThan(slowTicks);
  });
});

describe('Freischaltung', () => {
  it('ein größeres Haus braucht Tag, Ruf und bediente Gäste', () => {
    const { world, ledger } = setup();
    expect(() => remodel(world, ledger, 'MEDIUM', 5)).toThrow();
    world.day = 4;
    world.reputation = 40;
    world.guestsServed = 30;
    const next = remodel(world, ledger, 'MEDIUM', 5);
    expect(next.template).toBe('MEDIUM');
  });
});
