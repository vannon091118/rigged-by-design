/**
 * @test-target: src/core/sim/spawn.ts
 * @error-code: ERR-2001
 *
 * Sucht-Folgen (P-5): Wer erkennbar suechtig spielt (ADDICTED-Blase ab
 * ADDICTED_THRESHOLD), kostet das Haus Ruf — Umsatz gegen Standing. Ein Guard
 * halbiert den Malus (Spielerschutz-Beauftragter); der Deckel 6 entspricht der
 * Beziehungs-Spanne aus P-12.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { ADDICTED_THRESHOLD } from '../emotion';
import { reputation } from '../spawn';
import { createWorld, ensureStarter } from '../templates';
import { makeGuest } from '../traits';
import type { StaffAgent, WorldState } from '../types';

const SEED = 7;

const GUARD: StaffAgent = {
  id: 900, role: 'guard', x: 5, y: 5, path: [], pathIndex: 0, carryingCrate: null,
  workTicks: 0, task: 'patrol', blockedReason: '', targetDisputeId: null, qualification: 'GESELLE',
};

function house(): WorldState {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return world;
}

function addict(id: number, addiction = ADDICTED_THRESHOLD) {
  const guest = makeGuest({ id, persona: 'STAMMGAST', prng: new Prng(SEED + id), spawn: { x: 2, y: 13 } });
  guest.addiction = addiction;
  return guest;
}

describe('Sucht-Folgen', () => {
  it('kostet pro erkennbar suechtigem Gast einen Rufpunkt', () => {
    const world = house();
    const clean = reputation(world);
    world.guests.push(addict(1), addict(2), addict(3));
    expect(reputation(world)).toBe(clean - 3);
  });

  it('deckelt den Malus bei 6', () => {
    const world = house();
    const clean = reputation(world);
    for (let id = 1; id <= 10; id += 1) world.guests.push(addict(id));
    expect(reputation(world)).toBe(clean - 6);
  });

  it('halbiert den Malus mit Guard (abgerundet)', () => {
    const world = house();
    world.agents.push({ ...GUARD });
    const guarded = reputation(world);
    world.guests.push(addict(1), addict(2), addict(3));
    expect(reputation(world)).toBe(guarded - 1);
  });

  it('ignoriert Gaeste unter der ADDICTED-Schwelle', () => {
    const world = house();
    const clean = reputation(world);
    world.guests.push(addict(1, ADDICTED_THRESHOLD - 1));
    expect(reputation(world)).toBe(clean);
  });
});
