/** @test-target: src/core/sim/duel.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { duelPreview, resolveDuel } from '../duel';
import { duelOpponent } from '../duel-opponent';
import { simulateMugging } from '../mugging';
import { isInjured, playerMaxHp } from '../player-rpg';
import { hireAgent } from '../staff';
import { HAUSKONTO } from '../money';
import { ROBBERY_ACCOUNT } from '../penalty-pool';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { randomSeed } from '../../../test/random-seed';

function duelSetup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'seed', 0);
  const first = spawnGuest(world, prng, ledger)!;
  const second = spawnGuest(world, prng, ledger)!;
  for (const guest of [first, second]) {
    guest.state = 'ANGRY';
    guest.position = { x: first.position.x, y: first.position.y };
    guest.disputeId = 1;
  }
  world.disputes.push({ id: 1, guestIds: [first.id, second.id], x: first.position.x, y: first.position.y, level: 1, ticks: 0 });
  world.player.position = { x: first.position.x, y: first.position.y };
  return { world, ledger, prng, first, second };
}

describe('Duell mit Gegnerprofil', () => {
  it('leitet den Gegner stabil aus dem Streit ab', () => {
    const { world, first, second } = duelSetup();
    const dispute = world.disputes[0]!;
    const opponent = duelOpponent(world, dispute)!;
    expect(duelOpponent(world, dispute)).toEqual(opponent);
    expect([first.id, second.id]).toContain(opponent.guestId);
    expect(opponent.strength).toBeGreaterThanOrEqual(1);
    expect(opponent.strength).toBeLessThanOrEqual(10);
    expect(opponent.toughness).toBeLessThanOrEqual(10);
    expect(opponent.archetype.length).toBeGreaterThan(0);
  });

  it('mehr Brawl-Stufe hebt die Siegchance gegen denselben Gegner', () => {
    const { world } = duelSetup();
    const dispute = world.disputes[0]!;
    const weak = duelPreview(world, dispute)!;
    // Die Vorschau liest denselben Koerper wie der gefuehrte Kampf.
    expect([weak.player.hp, weak.player.maxHp]).toEqual([world.player.rpg.hp, playerMaxHp(world.player.rpg)]);
    world.player.rpg.brawlLevel = 6;
    const strong = duelPreview(world, dispute)!;
    expect(strong.opponent).toEqual(weak.opponent);
    expect(strong.winChance).toBeGreaterThan(weak.winChance);
    expect(strong.winChance).toBeLessThanOrEqual(100);
    expect(strong.player.maxHp).toBeGreaterThan(weak.player.maxHp);
  });

  it('Sieg räumt den Streit, gibt XP und entlässt die Beteiligten', () => {
    let won = false;
    for (let attempt = 0; attempt < 40 && !won; attempt += 1) {
      const { world, ledger, prng, first, second } = duelSetup();
      world.player.rpg.brawlLevel = 20;
      const result = resolveDuel(world, ledger, prng, 1);
      if (result.outcome !== 'WON') continue;
      won = true;
      expect(world.disputes).toHaveLength(0);
      expect(world.player.rpg.xp).toBeGreaterThanOrEqual(45);
      expect(first.disputeId).toBeNull();
      expect(second.disputeId).toBeNull();
      expect(result.mugging).toBeNull();
    }
    expect(won).toBe(true);
  });

  it('Niederlage kostet Laune und führt den Überfall aus dem Profil aus', () => {
    let lost = false;
    for (let attempt = 0; attempt < 40 && !lost; attempt += 1) {
      const { world, ledger, prng } = duelSetup();
      const moodBefore = world.guests.reduce((sum, guest) => sum + guest.mood, 0);
      const houseBefore = ledger.getBalance(HAUSKONTO);
      const result = resolveDuel(world, ledger, prng, 1);
      if (result.outcome !== 'LOST') continue;
      lost = true;
      expect(result.opponent).not.toBeNull();
      expect(result.mugging).not.toBeNull();
      expect(ledger.getBalance(ROBBERY_ACCOUNT)).toBe(result.mugging!.stolen);
      expect(result.mugging!.stolen).toBeLessThanOrEqual(houseBefore);
      expect(world.disputes).toHaveLength(0);
      expect(world.guests.reduce((sum, guest) => sum + guest.mood, 0)).toBeLessThanOrEqual(moodBefore);
      expect(world.activePenalties.some((penalty) => penalty.kind === 'MOOD_SHOCK')).toBe(true);
    }
    expect(lost).toBe(true);
  });

  it('ein unbekannter Streit liefert NONE ohne Buchung', () => {
    const { world, ledger, prng } = duelSetup();
    const entries = ledger.entryCount;
    const result = resolveDuel(world, ledger, prng, 99);
    expect(result).toEqual({ outcome: 'NONE', opponent: null, mugging: null, fight: null });
    expect(ledger.entryCount).toBe(entries);
  });

  it('greift aus der Distanz nicht ein', () => {
    const { world, ledger, prng } = duelSetup();
    world.player.position = { x: world.size - 2, y: world.size - 2 };
    const preview = duelPreview(world, world.disputes[0]!)!;
    expect(preview.inRange).toBe(false);
    const entries = ledger.entryCount;
    expect(resolveDuel(world, ledger, prng, 1).outcome).toBe('FAR');
    expect(world.disputes).toHaveLength(1);
    expect(ledger.entryCount).toBe(entries);
  });

  it('weicht einem Security aus, der am Streit steht', () => {
    const { world, ledger, prng } = duelSetup();
    const dispute = world.disputes[0]!;
    const guard = hireAgent(world, ledger, 'guard');
    guard.x = dispute.x;
    guard.y = dispute.y;
    const entries = ledger.entryCount;
    expect(resolveDuel(world, ledger, prng, 1).outcome).toBe('GUARD');
    expect(world.disputes).toHaveLength(1);
    expect(ledger.entryCount).toBe(entries);

    // Erst wenn der Security weg ist, greift der Spieler wieder selbst ein.
    guard.x = world.size - 2;
    guard.y = world.size - 2;
    expect(['WON', 'LOST']).toContain(resolveDuel(world, ledger, prng, 1).outcome);
    expect(world.disputes).toHaveLength(0);
  });

  it('eine Niederlage hinterlaesst Verletzung und weniger Lebenspunkte', () => {
    let lost = false;
    for (let attempt = 0; attempt < 60 && !lost; attempt += 1) {
      const { world, ledger, prng } = duelSetup();
      const result = resolveDuel(world, ledger, prng, 1);
      if (result.outcome !== 'LOST') continue;
      lost = true;
      expect(result.fight!.rounds).toBeGreaterThan(0);
      expect(isInjured(world.player.rpg) && world.player.rpg.hp < playerMaxHp(world.player.rpg)).toBe(true);
    }
    expect(lost).toBe(true);
  });
});

describe('Simulierter Überfall', () => {
  it('bucht nur ganze Mikro-Einheiten aus der Kasse und bleibt integritätsgeprüft', () => {
    let robbed = false;
    for (let attempt = 0; attempt < 40 && !robbed; attempt += 1) {
      const world = createWorld('SMALL');
      const ledger = new Ledger();
      const prng = new Prng(randomSeed());
      ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'seed', 0);
      world.player.position = { x: 2, y: 2 };
      const before = ledger.getBalance(HAUSKONTO);
      const result = simulateMugging(world, ledger, prng, { name: 'Test', archetype: 'Schläger', greed: 10, nerve: 10 });
      if (result.stolen <= 0) continue;
      robbed = true;
      expect(Number.isSafeInteger(result.stolen)).toBe(true);
      expect(ledger.getBalance(ROBBERY_ACCOUNT)).toBe(result.stolen);
      expect(ledger.getBalance(HAUSKONTO)).toBe(before - result.stolen);
      expect(ledger.entries.at(-1)?.reason.startsWith('Überfall')).toBe(true);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
      expect(result.target).toBe('KASSE');
    }
    expect(robbed).toBe(true);
  });

  it('ohne Geld gibt es kein Ziel und keine Buchung', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    const entries = ledger.entryCount;
    const result = simulateMugging(world, ledger, new Prng(randomSeed()), { name: 'Test', archetype: 'Schläger', greed: 10, nerve: 10 });
    expect(result).toEqual({ attempted: false, stolen: 0, caught: false, target: 'KEINE' });
    expect(ledger.entryCount).toBe(entries);
  });
});
