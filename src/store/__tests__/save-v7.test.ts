/**
 * @test-target: src/store/save.ts
 * @error-code: ERR-1002
 *
 * Ein v6-Spielstand bekommt Kisten, Agenten und Bedürfnisse mit Defaults; v7 bleibt rund.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { buyCrate } from '../../core/sim/deliveries';
import { hireAgent } from '../../core/sim/staff';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { replaySave } from '../save';

const GUEST = {
  id: 1, name: 'Testgast', persona: 'STREET', mood: 50, patience: 60, addiction: 70,
  sociability: 40, state: 'ENTER', stateTicks: 0, position: { x: 1, y: 1 }, path: [], pathIndex: 0,
  targetFurniture: 0, targetZone: 'entrance', queueIndex: 0, need: 'play', anger: 0, dirtTimer: 0,
  lastResult: '', spins: 0,
};

function legacyV6(overrides: Record<string, unknown> = {}) {
  return {
    version: 6,
    template: 'SMALL',
    carpet: 'VIOLET',
    furniture: [],
    guests: [GUEST],
    player: { position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '' },
    dirty: [],
    prices: {
      entryFee: 0, drinkPrice: fromVC(0.4), slotMinBet: fromVC(0.05), staffWage: fromVC(4),
      guardWage: fromVC(6), cleaningCost: fromVC(0.8), repairCost: fromVC(2),
    },
    staff: { guard: false, cleaner: false, bartender: false },
    tick: 12,
    day: 1,
    nextGuestId: 2,
    nextFurnitureId: 100,
    guardsHired: 0,
    lastEvent: 'v6 stand',
    entries: [],
    prngState: 7,
    ...overrides,
  };
}

describe('Save-Migration v6 auf v7', () => {
  it('füllt Kisten, Agenten, Bedürfnisse und Deko mit Defaults', () => {
    const loaded = replaySave(legacyV6())!;
    expect(loaded.world.crates).toEqual([]);
    expect(loaded.world.agents).toEqual([]);
    expect(loaded.world.disputes).toEqual([]);
    expect(loaded.world.parts).toBe(2);
    expect(loaded.world.guestsServed).toBe(0);
    expect(loaded.world.barLevel).toBe(1);
    expect(loaded.world.wcLevel).toBe(1);
    expect(loaded.world.nextCrateId).toBe(1);
    const guest = loaded.world.guests[0]!;
    expect(guest.thirst).toBeGreaterThanOrEqual(0);
    expect(guest.bladder).toBeGreaterThanOrEqual(0);
    expect(guest.disputeId).toBeNull();
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('behält Kisten, Agenten und Deko über Speichern und Laden', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(500), 'baukapital', 0);
    world.day = 5;
    world.guestsServed = 40;
    world.wallColor = '#112233';
    world.barLevel = 2;
    hireAgent(world, ledger, 'porter');
    buyCrate(world, ledger, 'PLANT');
    const saved = {
      version: 7,
      template: world.template,
      carpet: world.carpet,
      furniture: world.furniture,
      guests: world.guests,
      player: world.player,
      dirty: [...world.dirty],
      prices: world.prices,
      staff: world.staff,
      tick: world.tick,
      day: world.day,
      nextGuestId: world.nextGuestId,
      nextFurnitureId: world.nextFurnitureId,
      guardsHired: world.guardsHired,
      lastEvent: world.lastEvent,
      crates: world.crates,
      agents: world.agents,
      disputes: world.disputes,
      parts: world.parts,
      guestsServed: world.guestsServed,
      reputation: world.reputation,
      wallColor: world.wallColor,
      neonColor: world.neonColor,
      barLevel: world.barLevel,
      wcLevel: world.wcLevel,
      nextCrateId: world.nextCrateId,
      nextAgentId: world.nextAgentId,
      nextDisputeId: world.nextDisputeId,
      entries: ledger.entries.map(({ tick, from, to, amount, reason }) => ({ tick, from, to, amount, reason })),
      prngState: 99,
    };
    const loaded = replaySave(JSON.parse(JSON.stringify(saved)))!;
    expect(loaded.world.crates).toEqual(world.crates);
    expect(loaded.world.agents).toEqual(world.agents);
    expect(loaded.world.parts).toBe(world.parts);
    expect(loaded.world.wallColor).toBe('#112233');
    expect(loaded.world.barLevel).toBe(2);
    expect(loaded.world.guestsServed).toBe(40);
    expect(loaded.prngState).toBe(99);
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
