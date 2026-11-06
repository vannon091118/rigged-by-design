/** @test-target: src/core/sim/guest-play.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { actAtTarget, addictedStake, personaStake, sessionSpins } from '../guest-play';
import { guestAccount } from '../money';
import { makeGuest } from '../traits';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { TX_REASON } from '../tx-reasons';
import type { Furniture, PersonaId } from '../types';

function setup(addiction: number) {
  const world = createWorld('SMALL');
  const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
  guest.addiction = addiction;
  const item = world.furniture.find((entry) => entry.gameId === 'SLOT')!;
  const staked: Furniture = { ...item, baseBet: fromVC(1) };
  return addictedStake(world, staked, guest);
}

function guestFor(persona: PersonaId, addiction = 0) {
  const guest = makeGuest({ id: 1, persona, prng: new Prng(randomSeed()), spawn: { x: 1, y: 1 } });
  guest.addiction = addiction;
  return guest;
}

function slotFor(world = createWorld('SMALL')) {
  return world.furniture.find((entry) => entry.gameId === 'SLOT')!;
}

describe('Sucht steuert Einsatz und Sitzung', () => {
  it('setzt ohne Sucht den Grundbetrag', () => {
    expect(setup(0)).toBe(fromVC(1));
  });

  it('erhöht den Einsatz mit voller Sucht um die Hälfte', () => {
    expect(setup(100)).toBe(fromVC(1.5));
  });

  it('spielt ohne Sucht vier Spins', () => {
    expect(sessionSpins(0)).toBe(4);
  });

  it('spielt mit voller Sucht neun Spins', () => {
    expect(sessionSpins(100)).toBe(9);
  });

  it('skaliert den Einsatz mit Persona-Budget, aber hoechstens bis zum Dreifachen', () => {
    const world = createWorld('SMALL');
    const item = { ...slotFor(world), baseBet: fromVC(2) };
    expect(personaStake(world, item, guestFor('STREET'), fromVC(100))).toBe(fromVC(2));
    expect(personaStake(world, item, guestFor('BUSINESS'), fromVC(100))).toBe(fromVC(4.4));
    expect(personaStake(world, item, guestFor('HIGH_ROLLER'), fromVC(1_000))).toBe(fromVC(6));
  });

  it('nimmt nie mehr als der Gast besitzt und laesst ihn unter dem Mindesteinsatz gehen', () => {
    const world = createWorld('SMALL');
    const item = { ...slotFor(world), baseBet: fromVC(2) };
    expect(personaStake(world, item, guestFor('HIGH_ROLLER'), fromVC(3))).toBe(fromVC(2));
    expect(personaStake(world, item, guestFor('HIGH_ROLLER'), fromVC(1))).toBe(0);
  });
});

describe('Mods zahlen sich in der Gastrunde aus', () => {
  it('serviert FREE_DRINK aus echtem Bestand und bucht den Betriebsanteil', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(10), 'test chips', 0);
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    bar.stock = 3;
    const slot = slotFor(world);
    slot.mods.push('FREE_DRINK');
    guest.state = 'PLAY';
    guest.stateTicks = 0;
    actAtTarget(world, ledger, new Prng(randomSeed()), guest, slot);
    expect(bar.stock).toBe(2);
    expect(ledger.entries.some((entry) => entry.reason === TX_REASON.MOD_OPERATING)).toBe(true);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bucht ohne Barbestand keinen Betriebsanteil fuer FREE_DRINK', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const guest = spawnGuest(world, new Prng(randomSeed()), ledger)!;
    ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(10), 'test chips', 0);
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    bar.stock = 0;
    const slot = slotFor(world);
    slot.mods.push('FREE_DRINK');
    guest.state = 'PLAY';
    guest.stateTicks = 0;
    actAtTarget(world, ledger, new Prng(randomSeed()), guest, slot);
    expect(bar.stock).toBe(0);
    expect(ledger.entries.some((entry) => entry.reason === TX_REASON.MOD_OPERATING)).toBe(false);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
