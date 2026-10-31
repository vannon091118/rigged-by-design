/**
 * @test-target: src/core/sim/spawn.ts
 * @error-code: ERR-2001
 *
 * Ruf ist Betriebserfahrung: Ein frischer Automat in gutem Zustand ist kein Ruf,
 * und Dreck nimmt ihn wieder weg.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { getBuildDef } from '../offers';
import { reputation } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import type { WorldState } from '../types';

function fresh(): WorldState {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return world;
}

function addMachine(world: WorldState, buildId: 'BLACKJACK' | 'ROULETTE'): void {
  const def = getBuildDef(buildId);
  world.furniture.push({
    id: world.nextFurnitureId++, kind: def.kind, gameId: def.gameId, x: 1, y: 1, w: def.w, h: def.h,
    seats: def.seats, label: def.name, price: fromVC(0), quality: def.quality, condition: 100,
    damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false, zoneId: 'gaming', occupants: [],
    mods: [], reels: def.reels, baseBet: def.baseBet,
  });
}

describe('Ruf', () => {
  it('startet niedrig, statt direkt nach dem ersten Tick am Anschlag zu stehen', () => {
    const world = fresh();
    expect(reputation(world)).toBeGreaterThan(0);
    expect(reputation(world)).toBeLessThan(20);
  });

  it('waechst mit bedienten Gaesten, Ausstattung und Personal', () => {
    const world = fresh();
    const start = reputation(world);
    world.guestsServed = 300;
    world.satisfaction = 78;
    world.staff.cleaner = true;
    world.staff.cashier = true;
    world.staff.bartender = true;
    addMachine(world, 'BLACKJACK');
    addMachine(world, 'ROULETTE');
    expect(reputation(world)).toBeGreaterThan(start + 20);
    expect(reputation(world)).toBeLessThan(100);
  });

  it('nimmt bei Dreck wieder ab', () => {
    const world = fresh();
    world.guestsServed = 120;
    const clean = reputation(world);
    for (let tile = 0; tile < 40; tile += 1) world.dirty.add(100 + tile);
    expect(reputation(world)).toBeLessThan(clean);
  });

  it('ist ohne Angebot null', () => {
    const world = createWorld('SMALL');
    world.furniture = [];
    expect(reputation(world)).toBe(0);
  });
});
