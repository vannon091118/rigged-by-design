/**
 * @test-target: src/core/sim/needs.ts
 * @error-code: ERR-2001
 *
 * Bedürfnisse steuern Gastentscheidungen; Wut wird zum sichtbaren Streit mit Schaden.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { calmDispute, maybeStartBrawl, tickDisputes } from '../disputes';
import { chooseActivity } from '../guest-choice';
import { hireAgent } from '../staff';
import { guestAccount, HAUSKONTO } from '../money';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';
import { randomSeed } from '../../../test/random-seed';

function setup(seed = randomSeed()) {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(500), 'baukapital', 0);
  return { world, ledger, prng: new Prng(seed) };
}

describe('Bedürfnisse', () => {
  it('teilt höchstens 180 Profilpunkte aus, jeder Wert bleibt 0..100', () => {
    for (let i = 0; i < 20; i += 1) {
      const fresh = setup();
      const guest = spawnGuest(fresh.world, new Prng(randomSeed()), fresh.ledger)!;
      for (const value of [guest.mood, guest.patience, guest.addiction]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(guest.mood + guest.patience + guest.addiction).toBeLessThanOrEqual(180);
    }
  });

  it('Durst schickt an die Bar, volle Blase aufs WC', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
    guest.state = 'CHOOSE';
    guest.thirst = 95;
    guest.bladder = 5;
    chooseActivity(world, guest, ledger, prng);
    expect(guest.need).toBe('drink');
    expect(guest.state).toBe('DRINK');
    guest.thirst = 5;
    guest.bladder = 95;
    guest.state = 'CHOOSE';
    chooseActivity(world, guest, ledger, prng);
    expect(guest.need).toBe('toilet');
    expect(guest.state).toBe('TOILET');
  });

  it('ohne Spielzugang steigt die Sucht nicht', () => {
    const { world, ledger, prng } = setup();
    for (const item of world.furniture) item.damaged = true;
    const guest = spawnGuest(world, prng, ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(50), 'test chips', 0);
    const before = guest.addiction;
    for (let i = 0; i < 10; i += 1) {
      guest.state = 'CHOOSE';
      guest.thirst = 5;
      guest.bladder = 5;
      guest.mood = 80;
      guest.patience = 100;
      chooseActivity(world, guest, ledger, prng);
      expect(guest.state).not.toBe('PLAY');
    }
    expect(guest.addiction).toBe(before);
  });

  it('eine volle Blase erzeugt Dreck und kostet Laune', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    guest.mood = 80;
    guest.bladder = 100;
    const mood = guest.mood;
    tickWorld(world, ledger, prng);
    expect(guest.bladder).toBeLessThan(100);
    expect(guest.mood).toBeLessThan(mood);
    // needs.ts legt bei voller Blase eine echte Dreckspur an (Blase zurueck auf 35, Laune -8).
    expect(world.dirty.size).toBeGreaterThan(0);
    expect(guest.bladder).toBe(35);
  });
});

describe('Streit', () => {
  function angryPair() {
    const { world, ledger, prng } = setup();
    const a = spawnGuest(world, prng, ledger)!;
    const b = spawnGuest(world, prng, ledger)!;
    for (const guest of [a, b]) {
      guest.mood = 0;
      guest.state = 'ANGRY';
      guest.stateTicks = 5;
      guest.position = { ...a.position };
      guest.path = [];
    }
    return { world, ledger, prng, a, b };
  }

  function startDispute(world: ReturnType<typeof angryPair>['world'], a: ReturnType<typeof angryPair>['a'], b: ReturnType<typeof angryPair>['b']) {
    world.disputes.push({ id: 1, guestIds: [a.id, b.id], x: a.position.x, y: a.position.y, level: 1, ticks: 0 });
    a.disputeId = 1;
    b.disputeId = 1;
  }

  it('zwei wütende Gäste starten einen Disput', () => {
    const { world, prng, a, b } = angryPair();
    for (let i = 0; i < 40 && world.disputes.length === 0; i += 1) maybeStartBrawl(world, prng);
    expect(world.disputes).toHaveLength(1);
    expect(a.disputeId).toBe(world.disputes[0]!.id);
    expect(b.disputeId).toBe(world.disputes[0]!.id);
  });

  it('ein Guard löst den Disput auf, bevor Besitz kaputtgeht', () => {
    const { world, ledger, a, b } = angryPair();
    startDispute(world, a, b);
    expect(world.disputes).toHaveLength(1);
    hireAgent(world, ledger, 'guard');
    world.agents[0]!.x = world.disputes[0]!.x;
    world.agents[0]!.y = world.disputes[0]!.y;
    const conditions = world.furniture.map((item) => item.condition);
    tickDisputes(world);
    expect(world.disputes).toHaveLength(0);
    expect(world.furniture.map((item) => item.condition)).toEqual(conditions);
  });

  it('ohne Guard eskaliert der Streit und beschädigt Geräte', () => {
    const { world, a, b } = angryPair();
    startDispute(world, a, b);
    for (let i = 0; i < 14; i += 1) tickDisputes(world);
    const damaged = world.furniture.some((item) => item.damaged || item.condition < 100);
    expect(damaged).toBe(true);
  });

  it('der Spieler kann in Reichweite schlichten', () => {
    const { world, a, b } = angryPair();
    startDispute(world, a, b);
    const dispute = world.disputes[0]!;
    world.player.position = { x: dispute.x, y: dispute.y };
    expect(calmDispute(world, dispute.id)).toBe(true);
    expect(world.disputes).toHaveLength(0);
    expect(a.disputeId).toBeNull();
    expect(a.state).toBe('CHOOSE');
  });
});
