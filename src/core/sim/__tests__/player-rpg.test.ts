/** @test-target: src/core/sim/player-rpg.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { talkToGuest } from '../charisma-talk';
import { grantXp, newPlayerRpg, spendPoint } from '../player-rpg';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { randomSeed } from '../../../test/random-seed';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  return { world, ledger, prng };
}

describe('Spieler-RPG: XP und Attribute', () => {
  it('startet auf Level 1 mit null XP und ohne Punkte', () => {
    expect(newPlayerRpg()).toMatchObject({
      level: 1, xp: 0, unspentPoints: 0, speedLevel: 0, charismaLevel: 0, brawlLevel: 0,
    });
  });
  it('steigt bei genug XP auf und vergibt pro Stufe einen Skillpunkt', () => {
    const rpg = newPlayerRpg();
    grantXp(rpg, 10_000);
    expect(rpg.level).toBeGreaterThan(1);
    expect(rpg.unspentPoints).toBe(rpg.level - 1);
  });
  it('verteilt Punkte nur, wenn einer frei ist', () => {
    const rpg = newPlayerRpg();
    expect(spendPoint(rpg, 'charisma')).toBe(false);
    grantXp(rpg, 10_000);
    expect(spendPoint(rpg, 'charisma')).toBe(true);
    expect(rpg.charismaLevel).toBe(1);
  });
});

describe('Charisma-Interaktion', () => {
  it('Erfolg hebt die Laune und gibt Spieler-XP', () => {
    let success = false;
    for (let attempt = 0; attempt < 20 && !success; attempt += 1) {
      const { world, ledger, prng } = setup();
      const guest = spawnGuest(world, prng, ledger)!;
      guest.mood = 60;
      world.player.rpg.charismaLevel = 10;
      const result = talkToGuest(world, prng, guest.id);
      if (result?.success) {
        success = true;
        expect(guest.mood).toBeGreaterThan(60);
        expect(world.player.rpg.xp).toBeGreaterThan(0);
      }
    }
    expect(success).toBe(true);
  });
  it('Fehlschlag (Backfire) senkt die Laune', () => {
    let failed = false;
    for (let attempt = 0; attempt < 30 && !failed; attempt += 1) {
      const { world, ledger, prng } = setup();
      const guest = spawnGuest(world, prng, ledger)!;
      guest.mood = 60;
      const result = talkToGuest(world, prng, guest.id);
      if (result && !result.success) {
        failed = true;
        expect(guest.mood).toBeLessThan(60);
      }
    }
    expect(failed).toBe(true);
  });
  it('Backfire unter die Wut-Schwelle startet eine Prügelei', () => {
    let brawled = false;
    for (let attempt = 0; attempt < 120 && !brawled; attempt += 1) {
      const { world, ledger, prng } = setup();
      const guest = spawnGuest(world, prng, ledger)!;
      const other = spawnGuest(world, prng, ledger)!;
      other.position = { x: guest.position.x, y: guest.position.y };
      other.state = 'ANGRY';
      guest.mood = 26;
      const result = talkToGuest(world, prng, guest.id);
      if (result && !result.success && guest.mood < 25) {
        brawled = true;
        expect(world.disputes.length).toBeGreaterThan(0);
      }
    }
    expect(brawled).toBe(true);
  });
});
