/**
 * @test-target: src/core/sim/business-active-work.ts
 * @error-code: ERR-2001
 *
 * Der Spieler uebernimmt am eigenen Betrieb die Kernaufgabe seines Bereichs:
 * Tresen, Tisch und Lounge. Jede Aufgabe prueft Ort, Bestand, Gast und Personal,
 * wirkt ueber den vorhandenen Service- oder Spielpfad und bucht kein pauschales
 * Geld. Personal und Spieler schliessen sich an derselben Station aus.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { BUSINESS_WORK_SUBJECT, businessActiveWorkView, workBusinessTask } from '../business-active-work';
import { guestAccount, HAUSKONTO } from '../money';
import { buyProperty, propertyWorld } from '../property';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import type { Furniture, Guest, StaffAgent, WorldState } from '../types';

function setup(property: 'KNEIPE' | 'SPIELSALON' = 'KNEIPE', seed = randomSeed()) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(200), 'test hauskonto', 0);
  ledger.transfer('EXTERNAL_WORLD', 'PORTEMONNAIE', fromVC(300), 'test startgeld', 0);
  buyProperty(world, ledger, property, 0);
  return { world, ledger, prng: new Prng(seed) };
}

const atStation = (world: WorldState, item: Furniture | { readonly x: number; readonly y: number }): void => {
  world.player.position = { x: item.x, y: item.y };
};

function guestWithChips(world: WorldState, ledger: Ledger, prng: Prng, vc = 50): Guest {
  const guest = spawnGuest(world, prng, ledger)!;
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(vc) as VaCoinMicro, 'test chips', 0);
  return guest;
}

describe('Aktive Betreiberarbeit', () => {
  it('nennt ohne Immobilie keine ausfuehrbare Aufgabe', () => {
    const world = createWorld('SMALL');
    ensureStarter(world);
    const view = businessActiveWorkView(world);
    expect(view.owned).toBe(false);
    expect(view.tasks.every((task) => !task.ready)).toBe(true);
    expect(view.tasks[0]!.reason).toContain('Immobilie');
    expect(() => workBusinessTask(world, new Ledger(), new Prng(randomSeed()), 'BARKEEP')).toThrow(/Immobilie/);
  });

  it('bedient am eigenen Tresen einen wartenden Gast mit echtem Verkauf', () => {
    const { world, ledger, prng } = setup();
    const bar = propertyWorld(world)!.furniture.find((item) => item.kind === 'BAR')!;
    const guest = guestWithChips(world, ledger, prng);
    guest.state = 'DRINK';
    guest.targetFurniture = bar.id;
    guest.stateTicks = 0;
    guest.thirst = 90;
    guest.position = { x: bar.x, y: bar.y };
    atStation(world, bar);
    const houseBefore = ledger.getBalance(HAUSKONTO);
    const stockBefore = bar.stock;

    expect(businessActiveWorkView(world).tasks.find((task) => task.id === 'BARKEEP')?.ready).toBe(true);
    const notice = workBusinessTask(world, ledger, prng, 'BARKEEP');

    expect(notice).toContain(guest.name);
    expect(ledger.getBalance(HAUSKONTO)).toBeGreaterThan(houseBefore);
    expect(bar.stock).toBe(stockBefore - 1);
    expect(guest.thirst).toBe(0);
    expect(world.journal.filter((entry) => entry.subject === BUSINESS_WORK_SUBJECT)).toHaveLength(1);
    expect(businessActiveWorkView(world).lastShift).toBe(notice);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('laesst Personal und Spieler nicht dieselbe Bar-Schicht machen', () => {
    const { world, ledger, prng } = setup();
    const bar = propertyWorld(world)!.furniture.find((item) => item.kind === 'BAR')!;
    const guest = guestWithChips(world, ledger, prng);
    guest.state = 'DRINK';
    guest.targetFurniture = bar.id;
    guest.position = { x: bar.x, y: bar.y };
    atStation(world, bar);
    const barkeeper: StaffAgent = {
      id: world.nextAgentId++, role: 'bartender', x: bar.x, y: bar.y, path: [], pathIndex: 0,
      carryingCrate: null, workTicks: 0, task: 'serve', blockedReason: '', targetDisputeId: null, qualification: 'GESELLE',
    };
    world.agents.push(barkeeper);

    const task = businessActiveWorkView(world).tasks.find((entry) => entry.id === 'BARKEEP')!;
    expect(task.ready).toBe(false);
    expect(task.reason).toContain('Barkeeper');
    expect(() => workBusinessTask(world, ledger, prng, 'BARKEEP')).toThrow(/Barkeeper/);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(fromVC(50));
  });

  it('leitet eine Tischrunde am eigenen Tisch und laesst Skill die Wirkung heben', () => {
    const seed = randomSeed();
    const run = (level: number) => {
      const { world, ledger, prng } = setup('SPIELSALON', seed);
      const machine = propertyWorld(world)!.furniture.find((item) => item.gameId != null)!;
      const guest = guestWithChips(world, ledger, prng);
      guest.state = 'PLAY';
      guest.targetFurniture = machine.id;
      guest.stateTicks = 0;
      guest.position = { x: machine.x, y: machine.y };
      world.player.skills.cardDealing.level = level;
      atStation(world, machine);
      const before = { spins: guest.spins, mood: guest.mood };
      const notice = workBusinessTask(world, ledger, prng, 'CROUPIER');
      return { notice, spins: guest.spins - before.spins, mood: guest.mood - before.mood, guest };
    };

    const low = run(1);
    const high = run(5);
    expect(low.notice).toContain('Tischrunde');
    expect(low.spins).toBe(1);
    expect(low.guest.lastResult.length).toBeGreaterThan(0);
    expect(high.mood).toBeGreaterThan(low.mood);
  });

  it('betreut Gaeste in der eigenen Lounge ohne eigene Geldbuchung', () => {
    const { world, ledger, prng } = setup();
    const binding = propertyWorld(world)!;
    const lounge = binding.zones.find((zone) => zone.kind === 'LOUNGE')!;
    const guest = guestWithChips(world, ledger, prng);
    guest.position = { x: lounge.x + 1, y: lounge.y + 1 };
    guest.state = 'WAIT';
    guest.mood = 40;
    guest.patience = 40;
    atStation(world, lounge);
    const entriesBefore = ledger.entries.length;

    const notice = workBusinessTask(world, ledger, prng, 'HOST');

    expect(notice).toContain('Lounge');
    expect(guest.mood).toBeGreaterThan(40);
    expect(guest.patience).toBeGreaterThan(40);
    expect(ledger.entries).toHaveLength(entriesBefore);
  });

  it('verlangt die Naehe zur Station statt eines Verwaltungsklicks', () => {
    const { world, ledger, prng } = setup();
    const bar = propertyWorld(world)!.furniture.find((item) => item.kind === 'BAR')!;
    const guest = guestWithChips(world, ledger, prng);
    guest.state = 'DRINK';
    guest.targetFurniture = bar.id;
    guest.position = { x: bar.x, y: bar.y };
    world.player.position = { x: 1, y: 1 };

    const task = businessActiveWorkView(world).tasks.find((entry) => entry.id === 'BARKEEP')!;
    expect(task.ready).toBe(false);
    expect(task.reason).toContain('Tresen');
    expect(() => workBusinessTask(world, ledger, prng, 'BARKEEP')).toThrow(/Tresen/);
  });

  it('erhaelt Bestand, Gast und letzte Schicht ueber Save und Load', () => {
    const { world, ledger, prng } = setup();
    const bar = propertyWorld(world)!.furniture.find((item) => item.kind === 'BAR')!;
    const guest = guestWithChips(world, ledger, prng);
    guest.state = 'DRINK';
    guest.targetFurniture = bar.id;
    guest.stateTicks = 0;
    guest.thirst = 90;
    guest.position = { x: bar.x, y: bar.y };
    atStation(world, bar);
    workBusinessTask(world, ledger, prng, 'BARKEEP');

    const loaded = replaySave(JSON.parse(JSON.stringify(toSavedGame(world, ledger, 42))))!.world;
    const restoredBar = loaded.furniture.find((item) => item.id === bar.id)!;
    expect(restoredBar.stock).toBe(bar.stock);
    expect(businessActiveWorkView(loaded).lastShift).toBe(businessActiveWorkView(world).lastShift);
  });
});
