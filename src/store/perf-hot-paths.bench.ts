/**
 * @test-target: src/store/snapshot.ts
 * @error-code: ERR-1003
 *
 * Messpfad fuer RBD-16: langer Spielstand, 200 Gaeste, 90x90-Floor.
 * Bewusst nicht Teil von verify:all: misst Geschwindigkeit, wird nie rot.
 */
import { test } from 'vitest';
import { measure } from '../test/measure';
import { Ledger } from '../core/economy/ledger';
import { fromVC } from '../core/economy/vacoin';
import { guestAccount, HAUSKONTO } from '../core/sim/money';
import { dirtyNear } from '../core/sim/emotion';
import { blockedTiles, findPath, nearestWalkable } from '../core/sim/pathfinding';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { Guest } from '../core/sim/types';
import { buildView } from './snapshot';

const HISTORY = 5_000;
const GUESTS = 200;
const ITERATIONS = 20;

function guest(id: number): Guest {
  return {
    id, name: `Gast ${id}`, persona: 'STREET', mood: 60, patience: 50, addiction: 20,
    sociability: 40, thirst: 10, bladder: 10, disputeId: null, state: 'PLAY', stateTicks: 0,
    position: { x: (id % 80) + 5, y: (id % 70) + 5 }, path: [], pathIndex: 0, targetFurniture: 0,
    targetZone: 'gaming', queueIndex: 0, need: 'play', anger: 0, dirtTimer: 0, lastResult: '', spins: 1,
  };
}

const world = createWorld('LARGE');
ensureStarter(world);
const ledger = new Ledger();
ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(5000), 'start', 0);
for (let index = 1; index <= GUESTS; index += 1) {
  const entry = guest(index);
  world.guests.push(entry);
  ledger.transfer('EXTERNAL_WORLD', guestAccount(entry.id), fromVC(2), 'chips', 0);
}
for (let index = 0; index < HISTORY; index += 1) {
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(0.0001), 'verlauf', 0);
}

const dirty = new Set<number>();
for (let index = 0; index < 500; index += 1) dirty.add((index * 37) % (world.size * world.size));

test('Snapshot mit langer Ledger-Historie', { timeout: 60_000 }, () => {
  measure('buildView', () => {
    buildView(world, ledger, 'test');
  }, { iterations: ITERATIONS, note: `${GUESTS} Gaeste, ${HISTORY} Buchungen` });
});

test('Ledger-Integritaetspruefung', { timeout: 60_000 }, () => {
  measure('verify (voll)', () => {
    ledger.verifyLedgerIntegrity();
  }, { iterations: ITERATIONS, note: `${ledger.entries.length} Buchungen` });
});

test('Dreck in der Naehe', { timeout: 60_000 }, () => {
  measure('dirtyNear', () => {
    for (const entry of world.guests) {
      dirtyNear(dirty, world.size, entry.position.x, entry.position.y, 2);
    }
  }, { iterations: ITERATIONS, note: `${GUESTS} Gaeste, 500 Flecken` });
});

test('Navigation', { timeout: 60_000 }, () => {
  measure('blockedTiles', () => {
    blockedTiles(world.size, world.furniture);
  }, { iterations: ITERATIONS, note: `${world.furniture.length} Moebel, ${world.size}x${world.size}` });

  measure('findPath', () => {
    findPath(world.size, blockedTiles(world.size, world.furniture), { x: 2, y: 2 }, { x: 87, y: 87 });
  }, { iterations: 10, note: '90x90, diagonal' });

  const free = world.furniture[0]!;
  measure('nearestWalkable', () => {
    nearestWalkable(world.size, blockedTiles(world.size, world.furniture), { x: free.x, y: free.y });
  }, { iterations: ITERATIONS, note: 'Start auf einem Moebel' });
});
