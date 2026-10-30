/** @test-target: src/core/sim/player-rpg.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { talkToGuest } from '../charisma-talk';
import { resolvePlayerBrawl } from '../brawl-combat';
import { applyPenalty, rollPenalty } from '../penalty-pool';
import { HAUSKONTO } from '../money';
import { ROBBERY_ACCOUNT } from '../penalty-pool';
import { grantXp, newPlayerRpg, spendPoint } from '../player-rpg';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { randomSeed } from '../../../test/random-seed';

function setup(seed = randomSeed()) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(seed);
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

describe('Prügelei ohne Security', () => {
  function brawlSetup(seed: number) {
    const { world, ledger, prng } = setup(seed);
    const a = spawnGuest(world, prng, ledger)!;
    const b = spawnGuest(world, prng, ledger)!;
    world.guests.forEach((guest) => { guest.state = 'ANGRY'; guest.position = { x: a.position.x, y: a.position.y }; });
    world.disputes.push({ id: 1, guestIds: [a.id, b.id], x: a.position.x, y: a.position.y, level: 1, ticks: 0 });
    a.disputeId = 1;
    b.disputeId = 1;
    world.player.position = { x: a.position.x, y: a.position.y };
    return { world, ledger, prng, a, b };
  }
  it('Sieg setzt den Schläger vor die Tür und gibt +45 XP', () => {
    let won = false;
    for (let attempt = 0; attempt < 40 && !won; attempt += 1) {
      const { world, ledger, prng } = brawlSetup(randomSeed());
      world.player.rpg.brawlLevel = 20;
      const { outcome } = resolvePlayerBrawl(world, ledger, prng, 1);
      if (outcome === 'WON') {
        won = true;
        expect(world.disputes).toHaveLength(0);
        expect(world.player.rpg.xp).toBeGreaterThanOrEqual(45);
      }
    }
    expect(won).toBe(true);
  });
  it('Niederlage löst genau einen Straf-Event aus', () => {
    let lost = false;
    for (let attempt = 0; attempt < 40 && !lost; attempt += 1) {
      const { world, ledger, prng } = brawlSetup(randomSeed());
      const { outcome, penalty } = resolvePlayerBrawl(world, ledger, prng, 1);
      if (outcome === 'LOST') {
        lost = true;
        expect(['UNSAFE_REPUTATION', 'MOOD_SHOCK', 'ROBBERY']).toContain(penalty);
      }
    }
    expect(lost).toBe(true);
  });
});

describe('Straf-Event-Pool', () => {
  it('zieht nur gültige Straf-Typen', () => {
    const prng = new Prng(randomSeed());
    const kinds = new Set<string>();
    for (let i = 0; i < 100; i += 1) kinds.add(rollPenalty(prng));
    expect([...kinds].sort()).toEqual(['MOOD_SHOCK', 'ROBBERY', 'UNSAFE_REPUTATION']);
  });
  it('UNSAFE_REPUTATION setzt einen Tage-Timer', () => {
    const { world, ledger, prng } = setup();
    applyPenalty(world, ledger, prng, 'UNSAFE_REPUTATION');
    expect(world.activePenalties.some((p) => p.kind === 'UNSAFE_REPUTATION' && p.daysLeft >= 2)).toBe(true);
  });
  it('MOOD_SHOCK senkt Laune und Geduld aller Gäste', () => {
    const { world, ledger, prng } = setup();
    const guest = spawnGuest(world, prng, ledger)!;
    guest.mood = 80;
    guest.patience = 80;
    applyPenalty(world, ledger, prng, 'MOOD_SHOCK');
    expect(guest.mood).toBeLessThan(80);
    expect(guest.patience).toBeLessThan(80);
  });
  it('ROBBERY bucht den Verlust als Ledger-Transaktion und bleibt integer und integritätsgeprüft', () => {
    const { world, ledger, prng } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'seed', 0);
    const before = ledger.getBalance(HAUSKONTO);
    applyPenalty(world, ledger, prng, 'ROBBERY');
    const stolen = before - ledger.getBalance(HAUSKONTO);
    expect(stolen).toBeGreaterThan(0);
    expect(Number.isSafeInteger(stolen)).toBe(true);
    expect(ledger.getBalance(ROBBERY_ACCOUNT)).toBe(stolen);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - stolen);
    expect(ledger.entries.at(-1)?.reason).toBe('Ausgeraubt nach verlorener Prügelei');
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});

describe('Charisma-Interaktion', () => {
  it('Erfolg hebt die Laune und gibt Spieler-XP', () => {
    let success = false;
    for (let attempt = 0; attempt < 20 && !success; attempt += 1) {
      const { world, ledger, prng } = setup(randomSeed());
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
      const { world, ledger, prng } = setup(randomSeed());
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
      const { world, ledger, prng } = setup(randomSeed());
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
