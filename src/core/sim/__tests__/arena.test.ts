/** @test-target: src/core/sim/arena.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import {
  ARENA_ADMISSION_SUBJECT, arenaStage, arenaView, buildArena,
} from '../arena';
import { enterFightEvent } from '../fight-event';
import { EXTERNAL, HAUSKONTO, PORTEMONNAIE } from '../money';
import { buyProperty } from '../property';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { TX_REASON } from '../tx-reasons';
import { openVenueEvent } from '../venue-event';

function setup(house = 500, wallet = 400) {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(wallet), 'test startgeld', 0);
  if (house > 0) ledger.transfer(EXTERNAL, HAUSKONTO, fromVC(house), 'test betriebskonto', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

function owned(house = 500, wallet = 400) {
  const state = setup(house, wallet);
  buyProperty(state.world, state.ledger, 'KNEIPE', 0);
  return state;
}

const reasonsOf = (ledger: Ledger): string[] => ledger.entries.map((entry) => entry.reason);

describe('Eigene Arena als Business-Modul', () => {
  it('baut die drei Stufen vom Betriebskonto und leitet sie aus Belegen ab', () => {
    const { world, ledger } = owned();
    const empty = arenaView(world);
    expect(empty).toMatchObject({ owned: true, stage: 'KEINE', seats: 0, next: { stage: 'RING' } });
    expect(buildArena(world, ledger)).toBe('RING');
    expect(arenaStage(world)).toBe('RING');
    expect(arenaView(world)).toMatchObject({ label: 'Ring', seats: 8, ticketVC: 1, next: { stage: 'TRIBUENE' } });
    expect(reasonsOf(ledger)).toContain(TX_REASON.ARENA_BUILD);
    expect(buildArena(world, ledger)).toBe('TRIBUENE');
    expect(buildArena(world, ledger)).toBe('TECHNIK');
    expect(arenaView(world)).toMatchObject({ seats: 32, ticketVC: 3, next: null });
    expect(() => buildArena(world, ledger)).toThrow(/vollstaendig ausgebaut/);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('verweigert den Ausbau ohne Immobilie oder ohne Betriebsguthaben', () => {
    const bare = setup();
    expect(() => buildArena(bare.world, bare.ledger)).toThrow(/eigene Immobilie/);
    expect(arenaView(bare.world)).toMatchObject({ owned: false, note: 'Arena braucht eine eigene Immobilie.' });

    const poor = owned(10);
    expect(() => buildArena(poor.world, poor.ledger)).toThrow(/Betriebsguthaben/);
    expect(arenaStage(poor.world)).toBe('KEINE');
    expect(poor.ledger.getBalance(HAUSKONTO)).toBe(fromVC(10));
  });

  it('bucht den Einlass des Kampfabends aufs Betriebskonto', () => {
    const { world, ledger, prng } = owned();
    buildArena(world, ledger);
    openVenueEvent(world, 'TURNIER_ABEND');
    world.tick = 730;
    spawnGuest(world, prng, ledger);
    const before = ledger.getBalance(HAUSKONTO);
    enterFightEvent(world, ledger, prng);
    const admission = ledger.entries.find((entry) => entry.reason === TX_REASON.ARENA_ADMISSION);
    expect(admission?.amount).toBe(fromVC(world.guests.length));
    expect(ledger.getBalance(HAUSKONTO)).toBe(before + fromVC(world.guests.length));
    expect(world.archive.some((entry) => entry.subject === ARENA_ADMISSION_SUBJECT)).toBe(true);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('zeigt die vorhandene Bar als Gastronomie, ohne eine zweite zu bauen', () => {
    const { world } = owned();
    const view = arenaView(world);
    expect(view.barZones).toBe(world.zones.filter((zone) => zone.kind === 'BAR').length);
    expect(view.barZones).toBeGreaterThan(0);
  });
});
