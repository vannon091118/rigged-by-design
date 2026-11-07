/**
 * @test-target: src/core/sim/expansions.ts
 * @error-code: ERR-2001
 *
 * Ein Ausbau erhaelt Einrichtung, IDs, Gaeste, Personal und offene Anspruche;
 * er bucht nur die Differenz und laesst sich abbrechen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { buyCrate, takeCrate } from '../deliveries';
import { expandHouse, expansionCost, expansionZones, isExpansion, nextTemplateId } from '../expansions';
import { guestAccount, HAUSKONTO, pendingAccount } from '../money';
import { remodel } from '../remodel';
import { spawnGuest } from '../spawn';
import { hireAgent } from '../staff';
import { createWorld, ensureStarter } from '../templates';
import type { WorldState } from '../types';
import { loadWorld, saveWorld } from '../../../store/save';
import { randomSeed } from '../../../test/random-seed';

function house(template: 'SMALL' | 'MEDIUM' | 'LARGE' = 'SMALL', funding = 2000) {
  const world = createWorld(template);
  ensureStarter(world);
  const ledger = new Ledger();
  if (funding > 0) ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(funding), 'baukapital', 0);
  world.day = 9;
  world.reputation = 60;
  world.guestsServed = 90;
  return { world, ledger };
}

/** Ein Haus mit indivduellem Aufbau: Mods, Zustand, Kisten, Personal, Gast mit Anspruch. */
function furnished() {
  const { world, ledger } = house();
  world.furniture[1]!.mods.push('NEON');
  world.furniture[1]!.condition = 42;
  world.player.position = { x: 5, y: 9 };
  buyCrate(world, ledger, 'SLOT');
  takeCrate(world, world.crates[0]!.id, 'player');
  hireAgent(world, ledger, 'cleaner');
  const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
  ledger.transfer('EXTERNAL_WORLD', pendingAccount(guest.id), fromVC(2), 'test win', 0);
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
  return { world, ledger, guest };
}

const layout = (world: WorldState) =>
  world.furniture.map((item) => ({ id: item.id, x: item.x, y: item.y, mods: [...item.mods], condition: item.condition }));

describe('Ausbau', () => {
  it('erhaelt Moebel, Mods, IDs, Personal, Kisten und Gaeste', () => {
    const { world, ledger, guest } = furnished();
    const before = layout(world);
    const crateIds = world.crates.map((crate) => crate.id);
    const agentIds = world.agents.map((agent) => agent.id);
    const playerAt = { ...world.player.position };

    const next = remodel(world, ledger, 'MEDIUM', 5);

    expect(next.template).toBe('MEDIUM');
    expect(next.size).toBe(60);
    expect(layout(next)).toEqual(before);
    expect(next.crates.map((crate) => crate.id)).toEqual(crateIds);
    expect(next.agents.map((agent) => agent.id)).toEqual(agentIds);
    expect(next.player.position).toEqual(playerAt);
    expect(next.guests.map((entry) => entry.id)).toEqual([guest.id]);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(fromVC(2));
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(fromVC(5));
  });

  it('fuegt neue Bauflaechen an und laesst die alten Zonen unangetastet', () => {
    const { world, ledger } = furnished();
    const oldZones = [...world.zones];
    remodel(world, ledger, 'MEDIUM', 5);

    expect(world.zones.slice(0, oldZones.length)).toEqual(oldZones);
    const added = world.zones.slice(oldZones.length);
    expect(added).toHaveLength(3);
    expect(added.every((zone) => zone.kind === 'EXPANSION')).toBe(true);
    for (const zone of added) {
      // Jeder neue Block liegt ausserhalb des alten 30x30-Hauses.
      expect(zone.x >= 30 || zone.y >= 30).toBe(true);
      expect(zone.x + zone.w).toBeLessThanOrEqual(60);
      expect(zone.y + zone.h).toBeLessThanOrEqual(60);
      expect(zone.w).toBeGreaterThan(2);
    }
    // Die Vorlage legt keine Standardmoebel in die neuen Flaechen.
    expect(world.furniture.every((item) => item.x < 30 && item.y < 30)).toBe(true);
  });

  it('bucht nur die Differenz der Vorlagenpreise', () => {
    const { world, ledger } = house();
    const before = ledger.getBalance(HAUSKONTO);
    expect(expansionCost('SMALL', 'MEDIUM')).toBe(fromVC(90));
    remodel(world, ledger, 'MEDIUM', 5);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(90));
    expect(ledger.entries.some((entry) => entry.reason === 'ausbau MEDIUM' && entry.to === 'SHOP')).toBe(true);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('wandert die Fleck-Indizes auf die neue Brettbreite um', () => {
    const { world, ledger } = house();
    world.dirty = new Set([5 * 30 + 5, 2 * 30 + 7]);
    remodel(world, ledger, 'MEDIUM', 5);
    expect([...world.dirty].sort((a, b) => a - b)).toEqual([2 * 60 + 7, 5 * 60 + 5]);
  });

  it('bricht bei Unterdeckung ohne jede Veraenderung ab', () => {
    const { world, ledger } = house('SMALL', 0);
    const zones = world.zones.length;
    const furniture = world.furniture.length;
    expect(() => remodel(world, ledger, 'MEDIUM', 5)).toThrow(/kostet/);
    expect(world.template).toBe('SMALL');
    expect(world.size).toBe(30);
    expect(world.zones).toHaveLength(zones);
    expect(world.furniture).toHaveLength(furniture);
    expect(ledger.getBalance(HAUSKONTO)).toBe(0);
  });

  it('trennt Ausbau von Rueckbau und Umzug', () => {
    const { world, ledger } = house('LARGE');
    expect(isExpansion('SMALL', 'MEDIUM')).toBe(true);
    expect(isExpansion('LARGE', 'MEDIUM')).toBe(false);
    expect(nextTemplateId('MEDIUM')).toBe('LARGE');
    expect(() => expandHouse(world, ledger, 'MEDIUM', 5)).toThrow(/kleineres Haus/);
    expect(world.size).toBe(90);
  });

  it('waechst in zwei Schritten bis zur grossen Vorlage', () => {
    const { world, ledger } = furnished();
    remodel(world, ledger, 'MEDIUM', 5);
    remodel(world, ledger, 'LARGE', 6);
    expect(world.size).toBe(90);
    expect(world.zones.filter((zone) => zone.kind === 'EXPANSION')).toHaveLength(8);
    expect(expansionZones('MEDIUM', 'LARGE', 90, world.zones)).toHaveLength(0);
  });
});

describe('Ausbau und Spielstand', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('laedt nach Save/Load mit denselben Moebeln, Gaesten und Konten', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    });
    const { world, ledger, guest } = furnished();
    remodel(world, ledger, 'MEDIUM', 5);
    world.dirty = new Set([1 * 60 + 2]);
    const ids = layout(world);
    saveWorld(world, ledger, randomSeed());

    const loaded = loadWorld()!;
    expect(loaded.world.template).toBe('MEDIUM');
    expect(loaded.world.size).toBe(60);
    expect(layout(loaded.world)).toEqual(ids);
    expect(loaded.world.guests.map((entry) => entry.id)).toEqual([guest.id]);
    expect([...loaded.world.dirty]).toEqual([1 * 60 + 2]);
    expect(loaded.ledger.getBalance(pendingAccount(guest.id))).toBe(fromVC(2));
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
