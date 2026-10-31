/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Screenshot-Saat: eine eingerichtete Etage als Save-JSON ablegen, damit die
 * Aufnahme aus einem echten Weltzustand startet. Die Datei ist ein lokales
 * Werkzeug; der Seed ist zufaellig, die Ausstattung deterministisch.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { openHouse } from '../money';
import { BUILD_DEFS, type BuildId } from '../offers';
import { hireAgent } from '../staff';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import type { WorldState, Zone } from '../types';
import { canPlace } from '../world';
import { toSavedGame } from '../../../store/save';

const OUT = '.shot-data';

function spot(world: WorldState, zone: Zone, w: number, h: number): { x: number; y: number } | null {
  for (let y = zone.y + 2; y < zone.y + zone.h - h - 1; y += 2) {
    for (let x = zone.x + 2; x < zone.x + zone.w - w - 1; x += 3) {
      if (canPlace(world, x, y, w, h, true)) return { x, y };
    }
  }
  return null;
}

function place(world: WorldState, id: BuildId, zoneId: string): void {
  const def = BUILD_DEFS.find((entry) => entry.id === id);
  const zone = world.zones.find((entry) => entry.id === zoneId);
  if (!def || !zone) return;
  const at = spot(world, zone, def.w, def.h);
  if (!at) return;
  world.furniture.push({
    id: world.nextFurnitureId++, kind: def.kind, gameId: def.gameId, x: at.x, y: at.y,
    w: def.w, h: def.h, seats: def.seats, label: def.name, price: def.cost, quality: def.quality,
    condition: 100, damaged: false, dirt: 0, stock: 0, clog: 0, clogged: false, zoneId,
    occupants: [], mods: [], reels: def.reels, baseBet: def.baseBet,
  });
}

describe('Screenshot-Saat', () => {
  // Werkzeug, kein Testfall: schreibt Dateien und laeuft nur auf Anforderung (RBD_SHOT=1).
  it.skipIf(!process.env.RBD_SHOT)('schreibt eine eingerichtete Etage', () => {
    const world = createWorld('LARGE', 'VIOLET');
    const ledger = new Ledger();
    openHouse(ledger, 0);
    world.day = 4;
    world.reputation = 74;
    world.satisfaction = 82;
    world.demandTier = 'KONZERN';
    for (const id of ['SLOT', 'SLOT', 'SLOT', 'SLOT', 'PLINKO', 'BLACKJACK', 'POKER', 'ROULETTE', 'SHELL', 'DICE', 'BLACKJACK', 'POKER'] as BuildId[]) place(world, id, 'gaming');
    for (const role of ['cashier', 'cleaner', 'bartender', 'guard', 'porter'] as const) hireAgent(world, ledger, role);
    const bar = world.furniture.find((item) => item.kind === 'BAR');
    if (bar) bar.stock = 10;
    for (let index = 0; index < 12; index += 1) world.dirty.add((30 + index) * world.size + 34 + (index % 5));
    const prng = new Prng(randomSeed());
    for (let index = 0; index < 300; index += 1) tickWorld(world, ledger, prng);
    expect(world.furniture.length).toBeGreaterThan(12);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/ausgebaut.json`, JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    process.stdout.write(`ausgebaut: ${world.template} guests=${world.guests.length} furniture=${world.furniture.length} dirty=${world.dirty.size}\n`);
  });
});
