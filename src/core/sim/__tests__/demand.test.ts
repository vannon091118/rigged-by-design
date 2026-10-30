/**
 * @test-target: src/core/sim/demand.ts
 * @error-code: ERR-2001
 *
 * Nachfrage ist geplant: erster Gast terminiert, Quellen addieren sich,
 * Sitzplätze sperren keine Ankünfte.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { demandBreakdown, tickDemand } from '../demand';
import { guestAccount } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';
import { exchangePoint } from '../world';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  return { world: createWorld('SMALL'), ledger: new Ledger(), prng: new Prng(randomSeed()) };
}

describe('Ankunftsplanung', () => {
  it('lässt den ersten Gast nach festem Termin erscheinen, nicht nach Glückswurf', () => {
    const { world, ledger, prng } = setup();
    expect(world.nextArrivalTick).toBe(12);
    for (let step = 0; step < 12; step += 1) tickWorld(world, ledger, prng);
    expect(world.guests.length).toBeGreaterThan(0);
    expect(world.nextArrivalTick).toBeGreaterThan(world.tick);
  });

  it('sperrt den Eingang nicht bei besetzten Sitzplätzen', () => {
    const { world, ledger, prng } = setup();
    const slot = world.furniture.find((item) => item.gameId === 'SLOT')!;
    const seated = spawnGuest(world, prng, ledger)!;
    slot.occupants = [seated.id];
    world.nextArrivalTick = world.tick + 1;
    tickWorld(world, ledger, prng);
    expect(world.guests.length).toBeGreaterThanOrEqual(2);
    expect(slot.occupants).toContain(seated.id);
  });

  it('zahlt wütende Gäste aus, statt sie im ANGRY-Kreis zu halten', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
    guest.state = 'ANGRY';
    guest.stateTicks = 4;
    guest.mood = 0;
    guest.patience = 0;
    guest.position = { ...exchangePoint(world)! };
    guest.path = [];
    guest.pathIndex = 0;
    for (let step = 0; step < 20 && world.guests.some((entry) => entry.id === guest.id); step += 1) {
      tickWorld(world, ledger, prng);
    }
    expect(world.guests.some((entry) => entry.id === guest.id)).toBe(false);
    expect(world.guestsServed).toBeGreaterThanOrEqual(1);
  });

  it('lässt mehr Gäste herein, als die alten Hausgrenzen erlaubten', () => {
    const { world, ledger, prng } = setup();
    for (let index = 1; index <= 12; index += 1) {
      const guest = spawnGuest(world, prng, ledger);
      expect(guest?.id).toBe(index);
    }
    expect(world.guests).toHaveLength(12);
    expect(world.guests.length).toBeGreaterThan(10);
  });
});

describe('Nachfragequellen', () => {
  it('addiert Stammgäste und Unternehmensstufe, ohne eine Obergrenze zu setzen', () => {
    const { world } = setup();
    world.satisfaction = 100;
    const before = demandBreakdown(world);
    world.demandTier = 'KONZERN';
    world.visitors = [
      { id: 1, name: 'A', persona: 'STAMMGAST', visits: 3, lastSeenTick: 0 },
      { id: 2, name: 'B', persona: 'STAMMGAST', visits: 2, lastSeenTick: 0 },
      { id: 3, name: 'C', persona: 'BUSINESS', visits: 2, lastSeenTick: 0 },
    ];
    const after = demandBreakdown(world);
    expect(after.perDay).toBeGreaterThan(before.perDay);
    expect(after.sources.find((source) => source.id === 'TIER')!.perDay).toBe(24);
    expect(after.sources.find((source) => source.id === 'REGULARS')!.perDay).toBe(6);
  });

  it('macht echte Zufriedenheit zu einer eigenen Quelle', () => {
    const { world } = setup();
    world.satisfaction = 100;
    const happy = demandBreakdown(world).sources.find((source) => source.id === 'SATISFACTION')!.perDay;
    world.satisfaction = 0;
    const unhappy = demandBreakdown(world).sources.find((source) => source.id === 'SATISFACTION')!.perDay;
    expect(happy).toBe(8);
    expect(unhappy).toBe(0);
  });

  it('legt in der Abendstoßzeit eine zusätzliche Quelle obendrauf', () => {
    const { world } = setup();
    world.tick = 100;
    expect(demandBreakdown(world).sources.some((source) => source.id === 'PEAK')).toBe(false);
    world.tick = 400;
    expect(demandBreakdown(world).sources.find((source) => source.id === 'PEAK')!.perDay).toBe(5);
  });

  it('beendet eine Veranstaltung am geplanten Tick und nimmt ihre Nachfrage wieder heraus', () => {
    const { world, ledger, prng } = setup();
    world.demandTier = 'SAAL';
    world.tick = 700;
    world.nextArrivalTick = 10_000;
    world.demandEvent = { kind: 'NEON_NACHT', untilTick: 700 };
    tickDemand(world, ledger, prng);
    expect(world.demandEvent).toBeNull();
    expect(demandBreakdown(world).sources.some((source) => source.id === 'EVENT')).toBe(false);
  });
});
